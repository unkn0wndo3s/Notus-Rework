"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { useSocket } from "./socket-client";
import type {
  PersistedContentSnapshot,
  ServerToClientEvents,
  SocketAckResponse,
  TextUpdateData,
} from "./types";

type SyncStatus = 'synchronized' | 'saving' | 'unsynchronized';

interface UseCollaborativeNoteOptions {
  roomId: string | undefined;
  onRemoteContent: (content: string) => void;
  metadata?: {
    documentId?: string;
    userId?: number;
    userEmail?: string;
    title?: string;
    tags?: string[];
    getContentSnapshot?: () => PersistedContentSnapshot | null;
    cursorUsername?: string;
  };
  getCursorSnapshot?: () => { offset: number; x: number; y: number } | null;
  onSyncStatusChange?: (status: SyncStatus) => void;
  onPersisted?: (payload: { snapshot?: PersistedContentSnapshot | null; title?: string; tags?: string[] }) => void;
}

function generateClientId(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useCollaborativeNote({
  roomId,
  onRemoteContent,
  metadata,
  getCursorSnapshot,
  onSyncStatusChange,
  onPersisted,
}: UseCollaborativeNoteOptions) {
  const clientIdRef = useRef<string>(generateClientId());
  const {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
  } = useSocket(roomId);
  const pendingMarkdownRef = useRef<string>("");
  const lastObservedMarkdownRef = useRef<string>("");
  const pendingCharsRef = useRef<number>(0);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<SyncStatus>('synchronized');
  const apiFailureCountRef = useRef<number>(0);
  const [syncDisabled, setSyncDisabled] = useState<boolean>(false);
  const syncDisabledRef = useRef<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const lastFlushedContentRef = useRef<string>("");
  const isFlushingRef = useRef<boolean>(false);
  
  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    syncDisabledRef.current = syncDisabled;
  }, [syncDisabled]);

  // Track socket connection failures
  const socketFailureCountRef = useRef<number>(0);

  // Check if we're in offline mode (internet loss OR API loss OR socket connection failure)
  const checkOfflineMode = useCallback((): boolean => {
    // Condition 1: Loss of internet connection
    const internetOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    
    // Condition 2: Loss of API connection (3+ consecutive failures)
    const apiOffline = apiFailureCountRef.current >= 3;
    
    // Condition 3: Socket connection failures (1+ failure means we can't connect)
    const socketOffline = socketFailureCountRef.current >= 1;
    
    return internetOffline || apiOffline || socketOffline;
  }, []);

  // Initialize offline state immediately on mount
  useEffect(() => {
    const initialOffline = checkOfflineMode();
    if (initialOffline) {
      setIsOffline(true);
      setSyncDisabled(true);
    }
  }, [checkOfflineMode]); // Only on mount, checkOfflineMode is stable

  // Reset offline state when connection succeeds
  useEffect(() => {
    if (isConnected && socket && socket.connected) {
      // Connection successful - reset all failure counts and enable sync
      socketFailureCountRef.current = 0;
      apiFailureCountRef.current = 0;
      setIsOffline(false);
      setSyncDisabled(false);
    }
  }, [isConnected, socket]);

  // Update offline state when conditions change
  useEffect(() => {
    const updateOfflineState = () => {
      const shouldBeOffline = checkOfflineMode();
      // Also check if socket is not connected after a delay (connection failed)
      const socketNotConnected = Boolean(socket && !isConnected && !syncDisabled);
      
      if (shouldBeOffline !== isOffline || (socketNotConnected && !isOffline)) {
        const newOfflineState = shouldBeOffline || socketNotConnected;
        if (newOfflineState !== isOffline) {
          setIsOffline(newOfflineState);
          if (newOfflineState) {
            setSyncDisabled(true);
          }
        }
      }
    };

    // Check on mount and when dependencies change
    updateOfflineState();

    // Check immediately and periodically if socket connection failed
    // Check after 1 second first, then every 2 seconds
    const immediateCheck = setTimeout(() => {
      if (socket && !isConnected && !isOffline && !syncDisabled) {
        // Socket exists but not connected after 1 second - likely connection failure
        socketFailureCountRef.current += 1;
        updateOfflineState();
      }
    }, 1000);
    
    const checkInterval = setInterval(() => {
      if (socket && !isConnected && !isOffline && !syncDisabled) {
        // Socket exists but not connected after delay - likely connection failure
        socketFailureCountRef.current += 1;
        updateOfflineState();
      }
    }, 2000);

    // Listen to online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', updateOfflineState);
      window.addEventListener('offline', updateOfflineState);
      
      return () => {
        clearTimeout(immediateCheck);
        clearInterval(checkInterval);
        window.removeEventListener('online', updateOfflineState);
        window.removeEventListener('offline', updateOfflineState);
      };
    }
    
    return () => {
      clearTimeout(immediateCheck);
      clearInterval(checkInterval);
    };
  }, [checkOfflineMode, isOffline, socket, isConnected, syncDisabled]);

  const updateStatus = useCallback((status: SyncStatus) => {
    if (statusRef.current === status) return;
    statusRef.current = status;
    onSyncStatusChange?.(status);
  }, [onSyncStatusChange]);

  const buildContentSnapshot = useCallback(
    (override?: PersistedContentSnapshot | null) => {
      if (override) return override;
      if (metadata?.getContentSnapshot) {
        return metadata.getContentSnapshot();
      }
      return {
        text: pendingMarkdownRef.current || "",
        timestamp: Date.now(),
      };
    },
    [metadata]
  );

      const flushPendingChanges = useCallback(
    async (override?: {
      markdown?: string;
      contentSnapshot?: PersistedContentSnapshot | null;
      title?: string;
      tags?: string[];
    }) => {
      // Avoid multiple simultaneous calls
      if (isFlushingRef.current) {
        return Promise.resolve();
      }
      
      const candidateMarkdown = typeof override?.markdown === "string" ? override.markdown : pendingMarkdownRef.current;
      
      // Do nothing if content hasn't changed since last flush
      if (candidateMarkdown === lastFlushedContentRef.current) {
        return Promise.resolve();
      }
      
      isFlushingRef.current = true;
      // NEVER try to sync if offline - save locally only
      if (isOffline || checkOfflineMode()) {
        updateStatus('unsynchronized');
        if (metadata?.documentId && typeof window !== 'undefined') {
          try {
            const snapshot = buildContentSnapshot(override?.contentSnapshot);
            const contentString =
              typeof candidateMarkdown === "string" && candidateMarkdown.length > 0
                ? candidateMarkdown
                : snapshot?.text ?? '';
            const key = `notus:offline-doc:${metadata.documentId}`;
            const existing = localStorage.getItem(key);
            const existingData = existing ? JSON.parse(existing) : {};
            const payload = {
              ...existingData,
              id: Number(metadata.documentId),
              title: override?.title ?? metadata?.title ?? existingData.title,
              content: contentString,
              contentSnapshot: snapshot,
              tags: override?.tags ?? metadata?.tags ?? existingData.tags,
              updated_at: new Date().toISOString(),
              user_id: metadata?.userId ?? existingData.user_id,
              cachedAt: Date.now(),
              offline: true,
              apiFailed: true,
            };
            localStorage.setItem(key, JSON.stringify(payload));
          } catch (err) {
            // Silent fail - localStorage error
          }
        }
        lastFlushedContentRef.current = candidateMarkdown;
        isFlushingRef.current = false;
        return;
      }
      
      if (!socket || !roomId) {
        // If no socket, save locally
        if (metadata?.documentId && typeof window !== 'undefined') {
          try {
            const snapshot = buildContentSnapshot(override?.contentSnapshot);
            const contentString =
              typeof candidateMarkdown === "string" && candidateMarkdown.length > 0
                ? candidateMarkdown
                : snapshot?.text ?? '';
            const key = `notus:offline-doc:${metadata.documentId}`;
            const existing = localStorage.getItem(key);
            const existingData = existing ? JSON.parse(existing) : {};
            const payload = {
              ...existingData,
              id: Number(metadata.documentId),
              title: override?.title ?? metadata?.title ?? existingData.title,
              content: contentString,
              contentSnapshot: snapshot,
              tags: override?.tags ?? metadata?.tags ?? existingData.tags,
              updated_at: new Date().toISOString(),
              user_id: metadata?.userId ?? existingData.user_id,
              cachedAt: Date.now(),
              offline: true,
              apiFailed: true,
            };
            localStorage.setItem(key, JSON.stringify(payload));
          } catch (err) {
            // Silent fail - localStorage error
          }
        }
        lastFlushedContentRef.current = candidateMarkdown;
        isFlushingRef.current = false;
        return;
      }
      
      // NEVER try to sync if sync is disabled - save locally only
      if (syncDisabled) {
        if (metadata?.documentId && typeof window !== 'undefined') {
          try {
            const snapshot = buildContentSnapshot(override?.contentSnapshot);
            const contentString =
              typeof candidateMarkdown === "string" && candidateMarkdown.length > 0
                ? candidateMarkdown
                : snapshot?.text ?? '';
            const key = `notus:offline-doc:${metadata.documentId}`;
            const existing = localStorage.getItem(key);
            const existingData = existing ? JSON.parse(existing) : {};
            const payload = {
              ...existingData,
              id: Number(metadata.documentId),
              title: override?.title ?? metadata?.title ?? existingData.title,
              content: contentString,
              contentSnapshot: snapshot,
              tags: override?.tags ?? metadata?.tags ?? existingData.tags,
              updated_at: new Date().toISOString(),
              user_id: metadata?.userId ?? existingData.user_id,
              cachedAt: Date.now(),
              offline: true,
              apiFailed: true,
            };
            localStorage.setItem(key, JSON.stringify(payload));
            updateStatus('unsynchronized');
            } catch (err) {
              // Silent fail
            }
        }
        lastFlushedContentRef.current = candidateMarkdown;
        isFlushingRef.current = false;
        return;
      }
      
      // Check if socket is connected
      if (!socket.connected) {
        // Socket not connected, save locally
        if (metadata?.documentId && typeof window !== 'undefined') {
          try {
            const snapshot = buildContentSnapshot(override?.contentSnapshot);
            const contentString =
              typeof candidateMarkdown === "string" && candidateMarkdown.length > 0
                ? candidateMarkdown
                : snapshot?.text ?? '';
            const key = `notus:offline-doc:${metadata.documentId}`;
            const existing = localStorage.getItem(key);
            const existingData = existing ? JSON.parse(existing) : {};
            const payload = {
              ...existingData,
              id: Number(metadata.documentId),
              title: override?.title ?? metadata?.title ?? existingData.title,
              content: contentString,
              contentSnapshot: snapshot,
              tags: override?.tags ?? metadata?.tags ?? existingData.tags,
              updated_at: new Date().toISOString(),
              user_id: metadata?.userId ?? existingData.user_id,
              cachedAt: Date.now(),
              offline: true,
              apiFailed: true,
            };
            localStorage.setItem(key, JSON.stringify(payload));
            updateStatus('unsynchronized');
            } catch (err) {
              // Silent fail
            }
        }
        lastFlushedContentRef.current = candidateMarkdown;
        isFlushingRef.current = false;
        return;
      }
      // Create snapshot using candidateMarkdown if no snapshot provided
      let snapshot = override?.contentSnapshot;
      if (!snapshot && candidateMarkdown) {
        // Use getContentSnapshot if available, otherwise create a snapshot with candidateMarkdown
        if (metadata?.getContentSnapshot) {
          snapshot = metadata.getContentSnapshot();
          // Ensure snapshot contains the latest content
          if (snapshot && snapshot.text !== candidateMarkdown) {
            snapshot = { text: candidateMarkdown, timestamp: Date.now() };
          }
        } else {
          snapshot = { text: candidateMarkdown, timestamp: Date.now() };
        }
      } else if (!snapshot) {
        snapshot = buildContentSnapshot();
      }
      
      const contentString =
        typeof candidateMarkdown === "string" && candidateMarkdown.length > 0
          ? candidateMarkdown
          : snapshot?.text ?? '';

      if (typeof contentString !== "string") {
        isFlushingRef.current = false;
        return;
      }

      if (contentString.length === 0 && !snapshot) {
        isFlushingRef.current = false;
        return;
      }
      
      // Ensure snapshot contains current content
      if (snapshot && snapshot.text !== contentString) {
        snapshot = { text: contentString, timestamp: Date.now() };
      }

      if (isOffline || checkOfflineMode()) {
        updateStatus('unsynchronized');
        lastFlushedContentRef.current = contentString;
        isFlushingRef.current = false;
        // Save locally when offline
        if (metadata?.documentId && typeof window !== 'undefined') {
          try {
            const key = `notus:offline-doc:${metadata.documentId}`;
            const existing = localStorage.getItem(key);
            const existingData = existing ? JSON.parse(existing) : {};
            const payload = {
              ...existingData,
              id: Number(metadata.documentId),
              title: override?.title ?? metadata?.title ?? existingData.title,
              content: contentString,
              contentSnapshot: snapshot,
              tags: override?.tags ?? metadata?.tags ?? existingData.tags,
              updated_at: new Date().toISOString(),
              user_id: metadata?.userId ?? existingData.user_id,
              cachedAt: Date.now(),
              offline: true,
            };
            localStorage.setItem(key, JSON.stringify(payload));
          } catch (err) {
            // Silent fail - localStorage error
          }
        }
        lastFlushedContentRef.current = contentString;
        isFlushingRef.current = false;
        return;
      }

      // Double check we're not offline before creating payload
      if (isOffline || checkOfflineMode() || syncDisabled) {
        if (metadata?.documentId && typeof window !== 'undefined') {
          try {
            const key = `notus:offline-doc:${metadata.documentId}`;
            const existing = localStorage.getItem(key);
            const existingData = existing ? JSON.parse(existing) : {};
            const payload = {
              ...existingData,
              id: Number(metadata.documentId),
              title: override?.title ?? metadata?.title ?? existingData.title,
              content: contentString,
              contentSnapshot: snapshot,
              tags: override?.tags ?? metadata?.tags ?? existingData.tags,
              updated_at: new Date().toISOString(),
              user_id: metadata?.userId ?? existingData.user_id,
              cachedAt: Date.now(),
              offline: true,
              apiFailed: true,
            };
            localStorage.setItem(key, JSON.stringify(payload));
          } catch (err) {
            // Silent fail
          }
        }
        lastFlushedContentRef.current = contentString;
        isFlushingRef.current = false;
        return;
      }

      // Final check before creating payload - reset states if connected
      if (socket && socket.connected && isConnected && (syncDisabled || isOffline)) {
        // Connection is active, reset states to enable sync
        socketFailureCountRef.current = 0;
        apiFailureCountRef.current = 0;
        setIsOffline(false);
        setSyncDisabled(false);
        // Continue to sync below
      }
      
      // If still offline or sync disabled after reset attempt, save locally only
      if (isOffline || checkOfflineMode() || syncDisabled || !socket || !socket.connected || !isConnected) {
        if (metadata?.documentId && typeof window !== 'undefined') {
          try {
            const key = `notus:offline-doc:${metadata.documentId}`;
            const existing = localStorage.getItem(key);
            const existingData = existing ? JSON.parse(existing) : {};
            const payload = {
              ...existingData,
              id: Number(metadata.documentId),
              title: override?.title ?? metadata?.title ?? existingData.title,
              content: contentString,
              contentSnapshot: snapshot,
              tags: override?.tags ?? metadata?.tags ?? existingData.tags,
              updated_at: new Date().toISOString(),
              user_id: metadata?.userId ?? existingData.user_id,
              cachedAt: Date.now(),
              offline: true,
              apiFailed: true,
            };
            localStorage.setItem(key, JSON.stringify(payload));
          } catch (err) {
            // Silent fail
          }
        }
        updateStatus('unsynchronized');
        lastFlushedContentRef.current = contentString;
        isFlushingRef.current = false;
        return Promise.resolve();
      }

      const cursor = getCursorSnapshot?.();

      // Ensure we always have a valid snapshot if we have content and want to persist
      const finalSnapshot = snapshot || (contentString.length > 0 && metadata?.documentId && metadata?.userId && metadata?.userEmail
        ? {
            text: contentString,
            timestamp: Date.now(),
          }
        : undefined);

      const payload: TextUpdateData = {
        content: contentString,
        clientId: clientIdRef.current,
        ts: Date.now(),
        documentId: metadata?.documentId,
        userId: metadata?.userId,
        userEmail: metadata?.userEmail,
        title: override?.title ?? metadata?.title,
        tags: override?.tags ?? metadata?.tags,
        persistSnapshot: finalSnapshot,
        cursor: cursor
          ? {
              clientId: clientIdRef.current,
              username: metadata?.cursorUsername || clientIdRef.current,
              offset: cursor.offset,
              x: cursor.x,
              y: cursor.y,
              ts: Date.now(),
            }
          : undefined,
      };

      updateStatus('saving');

      return new Promise<void>((resolve) => {
        const ackCallback = (ack?: SocketAckResponse) => {
          if (!ack || ack.ok) {
            // Reset failure count on success - exit offline mode if API is back
            apiFailureCountRef.current = 0;
            socketFailureCountRef.current = 0;
            setIsOffline(false);
            setSyncDisabled(false);
            pendingCharsRef.current = 0;
            
            // Everything is OK - synchronized
            updateStatus('synchronized');
            // Mark content as flushed
            lastFlushedContentRef.current = contentString;
            // Call onPersisted if we have a snapshot
            if (payload.persistSnapshot) {
              onPersisted?.({
                snapshot: payload.persistSnapshot,
                title: payload.title,
                tags: payload.tags,
              });
            }
            isFlushingRef.current = false;
          } else {
            // Increment failure count
            apiFailureCountRef.current += 1;
            updateStatus('unsynchronized');
            
            // After 3 consecutive failures, activate offline mode
            if (apiFailureCountRef.current >= 3) {
              setIsOffline(true);
              setSyncDisabled(true);
              // Disconnect socket to stop all communication attempts
              if (socket && socket.connected) {
                socket.disconnect();
              }
            }
            
            // Always save locally when API fails
            if (metadata?.documentId && typeof window !== 'undefined') {
              try {
                const key = `notus:offline-doc:${metadata.documentId}`;
                const existing = localStorage.getItem(key);
                const existingData = existing ? JSON.parse(existing) : {};
                const localPayload = {
                  ...existingData,
                  id: Number(metadata.documentId),
                  title: override?.title ?? metadata?.title ?? existingData.title,
                  content: contentString,
                  contentSnapshot: snapshot,
                  tags: override?.tags ?? metadata?.tags ?? existingData.tags,
                  updated_at: new Date().toISOString(),
                  user_id: metadata?.userId ?? existingData.user_id,
                  cachedAt: Date.now(),
                  offline: true,
                  apiFailed: true,
                };
                localStorage.setItem(key, JSON.stringify(localPayload));
              } catch (err) {
                // Silent fail
              }
            }
            isFlushingRef.current = false;
          }
          resolve();
        };

      // Add timeout for socket emit (10 seconds)
        const timeoutId = setTimeout(() => {
          // Timeout - treat as failure
          apiFailureCountRef.current += 1;
          if (apiFailureCountRef.current >= 3) {
            setIsOffline(true);
            setSyncDisabled(true);
            // Disconnect socket to stop all communication attempts
            if (socket && socket.connected) {
              socket.disconnect();
            }
          }
          updateStatus('unsynchronized');
          // Save locally
          if (metadata?.documentId && typeof window !== 'undefined') {
            try {
              const key = `notus:offline-doc:${metadata.documentId}`;
              const existing = localStorage.getItem(key);
              const existingData = existing ? JSON.parse(existing) : {};
              const localPayload = {
                ...existingData,
                id: Number(metadata.documentId),
                title: override?.title ?? metadata?.title ?? existingData.title,
                content: contentString,
                contentSnapshot: snapshot,
                tags: override?.tags ?? metadata?.tags ?? existingData.tags,
                updated_at: new Date().toISOString(),
                user_id: metadata?.userId ?? existingData.user_id,
                cachedAt: Date.now(),
                offline: true,
                apiFailed: true,
              };
              localStorage.setItem(key, JSON.stringify(localPayload));
            } catch (err) {
              // Silent fail
            }
          }
          isFlushingRef.current = false;
          resolve();
        }, 10000);

        const wrappedAckCallback = (ack?: SocketAckResponse) => {
          clearTimeout(timeoutId);
          ackCallback(ack);
        };

        // Final check before emitting - reset states if connected
        if (socket && socket.connected && isConnected && (syncDisabled || isOffline)) {
          // Connection is active, reset states to enable sync
          socketFailureCountRef.current = 0;
          apiFailureCountRef.current = 0;
          setIsOffline(false);
          setSyncDisabled(false);
          // Continue to emit below
        }
        
        // If still offline or sync disabled after reset attempt, save locally only
        if (isOffline || checkOfflineMode() || syncDisabled || !socket || !socket.connected || !isConnected) {
          clearTimeout(timeoutId);
          updateStatus('unsynchronized');
          // Save locally
          if (metadata?.documentId && typeof window !== 'undefined') {
            try {
              const key = `notus:offline-doc:${metadata.documentId}`;
              const existing = localStorage.getItem(key);
              const existingData = existing ? JSON.parse(existing) : {};
              const localPayload = {
                ...existingData,
                id: Number(metadata.documentId),
                title: override?.title ?? metadata?.title ?? existingData.title,
                content: contentString,
                contentSnapshot: snapshot,
                tags: override?.tags ?? metadata?.tags ?? existingData.tags,
                updated_at: new Date().toISOString(),
                user_id: metadata?.userId ?? existingData.user_id,
                cachedAt: Date.now(),
                offline: true,
                apiFailed: true,
              };
              localStorage.setItem(key, JSON.stringify(localPayload));
            } catch (err) {
              // Silent fail
            }
          }
          isFlushingRef.current = false;
          resolve();
          return;
        }
        
        try {
          if (payload.cursor) {
            socket.emit('text-update-with-cursor', roomId, payload, wrappedAckCallback);
          } else {
            socket.emit('text-update', roomId, payload, wrappedAckCallback);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          // Emit failed, treat as failure
          apiFailureCountRef.current += 1;
          if (apiFailureCountRef.current >= 3) {
            setIsOffline(true);
            setSyncDisabled(true);
            // Disconnect socket to stop all communication attempts
            if (socket && socket.connected) {
              socket.disconnect();
            }
          }
          updateStatus('unsynchronized');
          // Save locally
          if (metadata?.documentId && typeof window !== 'undefined') {
            try {
              const key = `notus:offline-doc:${metadata.documentId}`;
              const existing = localStorage.getItem(key);
              const existingData = existing ? JSON.parse(existing) : {};
              const localPayload = {
                ...existingData,
                id: Number(metadata.documentId),
                title: override?.title ?? metadata?.title ?? existingData.title,
                content: contentString,
                contentSnapshot: snapshot,
                tags: override?.tags ?? metadata?.tags ?? existingData.tags,
                updated_at: new Date().toISOString(),
                user_id: metadata?.userId ?? existingData.user_id,
                cachedAt: Date.now(),
                offline: true,
                apiFailed: true,
              };
              localStorage.setItem(key, JSON.stringify(localPayload));
            } catch (err) {
              // Silent fail
            }
          }
          isFlushingRef.current = false;
          resolve();
        }
      });
    },
    [socket, roomId, buildContentSnapshot, getCursorSnapshot, metadata, onPersisted, updateStatus, syncDisabled, isOffline, checkOfflineMode, isConnected]
  );

  useEffect(() => {
    // Don't listen to socket events if sync is disabled, no socket, or offline
    // Also check navigator.onLine directly
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!socket || !roomId || syncDisabled || isOffline || checkOfflineMode()) {
      return;
    }

    const handleTextUpdate: ServerToClientEvents['text-update'] = (data) => {
      // Ignore own updates using clientId
      if (data.clientId && data.clientId === clientIdRef.current) {
        return;
      }
      
      // Double check offline mode is not active (may have changed)
      if (isOffline || checkOfflineMode() || syncDisabled) {
        return;
      }
      
      // NEVER apply remote content if sync is disabled or offline
      // This prevents rollbacks
      if (typeof data.content === 'string') {
        onRemoteContent(data.content);
      }
    };

    socket.on('text-update', handleTextUpdate);

    return () => {
      socket.off('text-update', handleTextUpdate);
    };
  }, [socket, roomId, onRemoteContent, syncDisabled, isOffline, checkOfflineMode]);

  // Listen to socket connection events to reset offline state when connection succeeds
  useEffect(() => {
    if (!socket) return;
    
    const handleSocketConnect = () => {
      // Reset failure counts and offline state when connection succeeds
      socketFailureCountRef.current = 0;
      apiFailureCountRef.current = 0;
      setIsOffline(false);
      setSyncDisabled(false);
      updateStatus('synchronized');
    };
    
    const handleSocketError = (error: unknown) => {
      socketFailureCountRef.current += 1;
      setIsOffline(true);
      setSyncDisabled(true);
      updateStatus('unsynchronized');
      
      // Disable socket reconnection completely
      if (socket.io && socket.io.opts) {
        socket.io.opts.reconnection = false;
        socket.io.opts.autoConnect = false;
      }
      // Disconnect and prevent reconnection
      if (socket.connected) {
        socket.disconnect();
      }
    };
    
    const handleSocketDisconnect = () => {
      // Disconnect also means we're offline
      if (!isOffline) {
        socketFailureCountRef.current += 1;
        setIsOffline(true);
        setSyncDisabled(true);
        updateStatus('unsynchronized');
      }
      
      // Disable socket reconnection completely
      if (socket.io && socket.io.opts) {
        socket.io.opts.reconnection = false;
        socket.io.opts.autoConnect = false;
      }
    };
    
    // If already connected, reset states immediately
    if (socket.connected && isConnected) {
      handleSocketConnect();
    }
    
    socket.on('connect', handleSocketConnect);
    socket.on('connect_error', handleSocketError);
    socket.on('disconnect', handleSocketDisconnect);
    
    return () => {
      socket.off('connect', handleSocketConnect);
      socket.off('connect_error', handleSocketError);
      socket.off('disconnect', handleSocketDisconnect);
    };
  }, [socket, isOffline, isConnected, updateStatus]);
  
  // Disable socket reconnection when offline mode is active
  useEffect(() => {
    if (!socket) return;
    
    if (isOffline || checkOfflineMode()) {
      // Disable all reconnection attempts
      if (socket.io && socket.io.opts) {
        socket.io.opts.reconnection = false;
        socket.io.opts.autoConnect = false;
      }
      // Disconnect if connected
      if (socket.connected) {
        socket.disconnect();
      }
      // Remove all reconnection listeners
      socket.io?.removeAllListeners('reconnect');
      socket.io?.removeAllListeners('reconnect_attempt');
      socket.io?.removeAllListeners('reconnect_error');
      socket.io?.removeAllListeners('reconnect_failed');
    }
  }, [socket, isOffline, checkOfflineMode]);

  useEffect(() => {
    // Never join room if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!socket || !roomId) return;
    
    // NEVER join room if offline mode is active
    if (isOffline || checkOfflineMode() || syncDisabled) {
      return;
    }
    
    const handleDisconnect = () => {
      socketFailureCountRef.current += 1;
      setIsOffline(true);
      setSyncDisabled(true);
      updateStatus('unsynchronized');
      
      // Disable socket reconnection completely
      if (socket.io && socket.io.opts) {
        socket.io.opts.reconnection = false;
        socket.io.opts.autoConnect = false;
      }
      // Immediately save current content locally
      if (metadata?.documentId && typeof window !== 'undefined') {
        try {
          const key = `notus:offline-doc:${metadata.documentId}`;
          const existing = localStorage.getItem(key);
          const existingData = existing ? JSON.parse(existing) : {};
          const snapshot = buildContentSnapshot();
          const payload = {
            ...existingData,
            id: Number(metadata.documentId),
            title: metadata?.title ?? existingData.title,
            content: pendingMarkdownRef.current || existingData.content || '',
            contentSnapshot: snapshot,
            tags: metadata?.tags ?? existingData.tags,
            updated_at: new Date().toISOString(),
            user_id: metadata?.userId ?? existingData.user_id,
            cachedAt: Date.now(),
            offline: true,
            apiFailed: true,
          };
          localStorage.setItem(key, JSON.stringify(payload));
        } catch (err) {
          // Silent fail
        }
      }
    };
    
    const handleConnectError = (error?: unknown) => {
      socketFailureCountRef.current += 1;
      setIsOffline(true);
      setSyncDisabled(true);
      updateStatus('unsynchronized');
      
      // Disable socket reconnection completely
      if (socket.io && socket.io.opts) {
        socket.io.opts.reconnection = false;
        socket.io.opts.autoConnect = false;
      }
      // Disconnect if connected
      if (socket.connected) {
        socket.disconnect();
      }
      // Immediately save current content locally
      if (metadata?.documentId && typeof window !== 'undefined') {
        try {
          const key = `notus:offline-doc:${metadata.documentId}`;
          const existing = localStorage.getItem(key);
          const existingData = existing ? JSON.parse(existing) : {};
          const snapshot = buildContentSnapshot();
          const payload = {
            ...existingData,
            id: Number(metadata.documentId),
            title: metadata?.title ?? existingData.title,
            content: pendingMarkdownRef.current || existingData.content || '',
            contentSnapshot: snapshot,
            tags: metadata?.tags ?? existingData.tags,
            updated_at: new Date().toISOString(),
            user_id: metadata?.userId ?? existingData.user_id,
            cachedAt: Date.now(),
            offline: true,
            apiFailed: true,
          };
          localStorage.setItem(key, JSON.stringify(payload));
        } catch (err) {
          // Silent fail
        }
      }
    };
    
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    
    const currentClientId = clientIdRef.current;
    joinRoom(roomId, currentClientId);
    
      return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      leaveRoom(roomId, currentClientId);
    };
  }, [socket, roomId, joinRoom, leaveRoom, metadata, buildContentSnapshot, updateStatus, syncDisabled, isOffline, checkOfflineMode]);

  const emitLocalChange = useCallback(
    (markdown: string) => {
      if (!roomId) return;
      
      // Do nothing if content hasn't changed since last flush
      if (markdown === lastFlushedContentRef.current && isFlushingRef.current) {
        return;
      }
      
      pendingMarkdownRef.current = markdown;
      const previous = lastObservedMarkdownRef.current || "";
      const positiveDiff = Math.max(0, markdown.length - previous.length);
      pendingCharsRef.current += positiveDiff;
      lastObservedMarkdownRef.current = markdown;
      
      // Only update status if we're not already flushing
      if (!isFlushingRef.current) {
        updateStatus('unsynchronized');
      }

      // Save locally function
      const saveLocally = () => {
        if (metadata?.documentId && typeof window !== 'undefined') {
          try {
            const key = `notus:offline-doc:${metadata.documentId}`;
            const existing = localStorage.getItem(key);
            const existingData = existing ? JSON.parse(existing) : {};
            const snapshot = buildContentSnapshot();
            const payload = {
              ...existingData,
              id: Number(metadata.documentId),
              title: metadata?.title ?? existingData.title,
              content: markdown,
              contentSnapshot: snapshot,
              tags: metadata?.tags ?? existingData.tags,
              updated_at: new Date().toISOString(),
              user_id: metadata?.userId ?? existingData.user_id,
              cachedAt: Date.now(),
              offline: true,
              apiFailed: syncDisabled,
            };
            localStorage.setItem(key, JSON.stringify(payload));
            } catch (err) {
              // Silent fail
            }
        }
      };

      // If socket is connected and collaboration is available, allow sync
      const canSync = socket && socket.connected && isConnected && !syncDisabled && !isOffline && !checkOfflineMode();
      
      if (!canSync) {
        // If we're connected but sync is disabled, try to re-enable it
        if (socket && socket.connected && isConnected && (syncDisabled || isOffline)) {
          // Connection is active, reset states
          socketFailureCountRef.current = 0;
          apiFailureCountRef.current = 0;
          setIsOffline(false);
          setSyncDisabled(false);
          // Continue to sync below
        } else {
          // Not connected or offline - save locally only
          saveLocally();
          if (flushTimeoutRef.current) {
            clearTimeout(flushTimeoutRef.current);
            flushTimeoutRef.current = null;
          }
          return;
        }
      }
      
      // Final check: if still no socket or not connected, save locally
      if (!socket || !socket.connected || !isConnected) {
        saveLocally();
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        return;
      }

      const endsWithWordBoundary = /[A-Za-zÀ-ÖØ-öø-ÿ]+\s$/u.test(markdown);
      
      // Cancel previous timeout
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      
      // Immediate flush if we have enough characters or if we finish a word
      if (pendingCharsRef.current >= 10 || endsWithWordBoundary) {
        flushPendingChanges({ markdown }).catch(() => {});
      } else {
        // Otherwise, flush after a delay
        flushTimeoutRef.current = setTimeout(() => {
          flushPendingChanges({ markdown }).catch(() => {});
          flushTimeoutRef.current = null;
        }, 500);
      }
    },
    [flushPendingChanges, socket, roomId, updateStatus, buildContentSnapshot, metadata, syncDisabled, isOffline, checkOfflineMode, isConnected]
  );

  // Final flush on unmount and on beforeunload/blur to ensure last content is saved
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const currentClientId = clientIdRef.current;
    
    const flushPending = () => {
      // Cancel current timeout
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      
      // Flush last content if we have pending content
      if (pendingMarkdownRef.current && socket && socket.connected && isConnected && !syncDisabled && !isOffline) {
        flushPendingChanges({ markdown: pendingMarkdownRef.current }).catch(() => {
          // Silent fail
        });
      }
    };
    
    const handleBeforeUnload = () => {
      // Leave room before leaving page
      if (socket && roomId && socket.connected) {
        leaveRoom(roomId, currentClientId);
      }
      flushPending();
    };
    
    // Flush when user leaves the page
    window.addEventListener('beforeunload', handleBeforeUnload);
    // Flush when window loses focus (user changes tab)
    window.addEventListener('blur', flushPending);
    
    return () => {
      // Clean up listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('blur', flushPending);
      
      // Leave room on unmount
      if (socket && roomId && socket.connected) {
        leaveRoom(roomId, currentClientId);
      }
      
      // Flush last content on unmount
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      
      if (pendingMarkdownRef.current && socket && socket.connected && isConnected && !syncDisabled && !isOffline) {
        flushPendingChanges({ markdown: pendingMarkdownRef.current }).catch(() => {
          // Silent fail - cannot wait during unmount
        });
      }
    };
  }, [socket, roomId, isConnected, syncDisabled, isOffline, flushPendingChanges, leaveRoom]);

  return { isConnected, emitLocalChange, clientId: clientIdRef.current, flushPendingChanges, isOffline };
}


