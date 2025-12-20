import { useEffect, useRef, useCallback, useState } from "react";
import { useSocket } from "./socket-client";
import type { ServerToClientEvents, CursorPositionData } from "./types";

interface UseCursorTrackingOptions {
  roomId: string | undefined;
  editorRef: React.RefObject<HTMLDivElement | null>;
  clientId: string;
  username: string;
}

interface RemoteCursor {
  clientId: string;
  username: string;
  x: number;
  y: number;
  offset: number;
  lastUpdate: number;
}

export function useCursorTracking({
  roomId,
  editorRef,
  clientId,
  username,
}: UseCursorTrackingOptions) {
  const { socket, isConnected } = useSocket(roomId);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const cursorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to get cursor position in the editor
  const getCursorPosition = useCallback((): { offset: number; x: number; y: number } | null => {
    if (!editorRef.current) return null;

    const selection = globalThis.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const editor = editorRef.current;

    // Check that cursor is in the editor
    if (!editor.contains(range.commonAncestorContainer)) {
      return null;
    }

    // Calculate cursor offset in text
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editor);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const offset = preCaretRange.toString().length;

    // Get visual cursor position
    const rect = range.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();

    // If cursor is invisible (end of line or empty element), create a temporary marker
    let x = rect.left - editorRect.left;
    let y = rect.top - editorRect.top;

    if (rect.width === 0 || rect.height === 0) {
      try {
        const tempSpan = globalThis.document.createElement('span');
        tempSpan.textContent = '\u200b'; // Zero-width space
        tempSpan.style.position = 'absolute';
        tempSpan.style.visibility = 'hidden';
        range.insertNode(tempSpan);
        const tempRect = tempSpan.getBoundingClientRect();
        x = tempRect.left - editorRect.left;
        y = tempRect.top - editorRect.top;
        tempSpan.remove();
      } catch (e) {
        console.error("Failed to insert temporary marker for cursor position calculation:", e);
      }
    }

    return { offset, x, y };
  }, [editorRef]);

  // Function to send cursor position
  const sendCursorPosition = useCallback(() => {
    // Never send cursor position if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!socket || !roomId || !isConnected) return;

    const position = getCursorPosition();
    if (!position) return;

    const cursorData: CursorPositionData = {
      clientId,
      username,
      offset: position.offset,
      x: position.x,
      y: position.y,
      ts: Date.now(),
    };

    socket.emit('cursor-position', roomId, cursorData);
  }, [socket, roomId, isConnected, clientId, username, getCursorPosition]);

  // Listen to cursor movement events
  useEffect(() => {
    if (!editorRef.current || !roomId) return;

    const editor = editorRef.current;

    const handleCursorMove = () => {
      // Delay to avoid too many sends
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current);
      }

      cursorUpdateTimeoutRef.current = setTimeout(() => {
        sendCursorPosition();
      }, 50); // Send every 50ms max
    };

    // Listen to cursor movement events
    editor.addEventListener('keyup', handleCursorMove);
    editor.addEventListener('click', handleCursorMove);
    editor.addEventListener('mouseup', handleCursorMove);

    // Also listen to selection changes (for arrows, etc.)
    document.addEventListener('selectionchange', handleCursorMove);

    return () => {
      editor.removeEventListener('keyup', handleCursorMove);
      editor.removeEventListener('click', handleCursorMove);
      editor.removeEventListener('mouseup', handleCursorMove);
      document.removeEventListener('selectionchange', handleCursorMove);
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current);
      }
    };
  }, [editorRef, roomId, sendCursorPosition]);

  // Listen to cursor positions of other users
  useEffect(() => {
    // Never listen to socket events if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!socket || !roomId) return;

    const handleCursorPosition: ServerToClientEvents['cursor-position'] = (data) => {
      // Ignore our own cursor
      if (data.clientId === clientId) return;

      setRemoteCursors((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.clientId, {
          clientId: data.clientId,
          username: data.username,
          x: data.x,
          y: data.y,
          offset: data.offset,
          lastUpdate: data.ts,
        });
        return newMap;
      });
    };

    socket.on('cursor-position', handleCursorPosition);

    return () => {
      socket.off('cursor-position', handleCursorPosition);
    };
  }, [socket, roomId, clientId]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleTextUpdateCursor: ServerToClientEvents['text-update'] = (data) => {
      if (!data?.cursor || data.cursor.clientId === clientId) return;
      const cursor = data.cursor;
      setRemoteCursors((prev) => {
        const newMap = new Map(prev);
        newMap.set(cursor.clientId, {
          clientId: cursor.clientId,
          username: cursor.username || cursor.clientId,
          x: cursor.x,
          y: cursor.y,
          offset: cursor.offset,
          lastUpdate: cursor.ts,
        });
        return newMap;
      });
    };

    socket.on('text-update', handleTextUpdateCursor);

    return () => {
      socket.off('text-update', handleTextUpdateCursor);
    };
  }, [socket, roomId, clientId]);

  // Cursors are only removed when user leaves document (via user-left event)

  // Cleanup cursors when a user leaves
  useEffect(() => {
    if (!socket || !roomId) return;

    const handleUserLeft: ServerToClientEvents['user-left'] = (userId) => {
      setRemoteCursors((prev) => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
    };

    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, roomId]);

  // Cleanup cursors that haven't been updated for a while (timeout)
  useEffect(() => {
    if (!socket || !roomId) return;

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const TIMEOUT_MS = 60000; // 60 seconds without update = considered disconnected

      setRemoteCursors((prev) => {
        const newMap = new Map(prev);
        let hasChanges = false;

        for (const [cursorId, cursor] of newMap.entries()) {
          if (now - cursor.lastUpdate > TIMEOUT_MS) {
            newMap.delete(cursorId);
            hasChanges = true;
          }
        }

        return hasChanges ? newMap : prev;
      });
    }, 1000); // Check every second

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [socket, roomId]);

  return { remoteCursors };
}


