"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import WysiwygEditor from "./Editor/WysiwygEditor";
import WysiwygToolbar from "./Toolbar/WysiwygToolbar";
import { useCollaborativeNote } from "@/lib/paper.js/useCollaborativeNote";
import { useLocalSession } from "@/hooks/useLocalSession";

interface SnapshotPayload {
  text: string;
  timestamp?: number;
}

interface FlushOverride {
  markdown?: string;
  content?: SnapshotPayload | null;
  title?: string;
  tags?: string[];
}

interface WysiwygNotepadProps {
  initialData?: { text: string };
  onContentChange?: (content: SnapshotPayload) => void;
  onRemoteContentChange?: (content: SnapshotPayload) => void;
  placeholder?: string;
  className?: string;
  showDebug?: boolean;
  readOnly?: boolean;
  roomId?: string;
  documentId?: string;
  userId?: number;
  userEmail?: string;
  title?: string;
  tags?: string[];
  getContentSnapshot?: () => SnapshotPayload | null;
  onSyncStatusChange?: (status: 'synchronized' | 'saving' | 'unsynchronized') => void;
  onPersisted?: (payload: { snapshot?: SnapshotPayload | null; title?: string; tags?: string[] }) => void;
  onRegisterFlush?: (flush: (override?: FlushOverride) => Promise<void>) => void;
  onRealtimeConnectionChange?: (connected: boolean) => void;
  onOpenSynthesis?: () => void;
}

export default function WysiwygNotepad({
  initialData = { text: "" },
  onContentChange,
  onRemoteContentChange,
  placeholder = "Start writing your document...",
  className = "",
  showDebug = false,
  readOnly = false,
  roomId,
  documentId,
  userId,
  userEmail,
  title,
  tags,
  getContentSnapshot,
  onSyncStatusChange,
  onPersisted,
  onRegisterFlush,
  onRealtimeConnectionChange,
  onOpenSynthesis,
}: WysiwygNotepadProps) {
  const [markdown, setMarkdown] = useState(initialData.text || "");
  const [debugMode, setDebugMode] = useState(showDebug);
  const { username } = useLocalSession();
  const editorElementRef = useRef<HTMLDivElement | null>(null);

  const cursorSnapshot = useCallback(() => {
    const editor = editorElementRef.current;
    if (!editor) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editor);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const offset = preCaretRange.toString().length;
    const rect = range.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    let x = rect.left - editorRect.left;
    let y = rect.top - editorRect.top;
    if (rect.width === 0 || rect.height === 0) {
      try {
        const tempSpan = document.createElement('span');
        tempSpan.textContent = '\u200b';
        tempSpan.style.position = 'absolute';
        tempSpan.style.visibility = 'hidden';
        range.insertNode(tempSpan);
        const tempRect = tempSpan.getBoundingClientRect();
        x = tempRect.left - editorRect.left;
        y = tempRect.top - editorRect.top;
        tempSpan.remove();
      } catch {
        // Ignore selection errors
      }
    }
    return { offset, x, y };
  }, []);

  const contentSnapshotProvider = useCallback(() => {
    if (getContentSnapshot) {
      return getContentSnapshot();
    }
    return {
      text: markdown,
      timestamp: Date.now(),
    };
  }, [getContentSnapshot, markdown]);

  // Normalize markdown to limit consecutive empty lines (max 2)
  const normalizeMarkdown = useCallback((markdown: string): string => {
    if (!markdown) return markdown;
    
    // Replace 3+ consecutive empty lines with max 2 empty lines
    // This preserves intentional spacing (1-2 empty lines) while removing excessive ones
    return markdown.replace(/\n{3,}/g, '\n\n');
  }, []);

  const {
    emitLocalChange: emitChange,
    isConnected,
    clientId,
    flushPendingChanges,
    isOffline,
  } = useCollaborativeNote({
    roomId,
    onRemoteContent: (remote: string) => {
      // NEVER apply remote content in offline mode - this prevents rollbacks
      // This should never be called in offline mode, but double-check for safety
      if (isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return;
      }
      
      // Normalize remote markdown to limit consecutive empty lines
      const normalizedRemote = normalizeMarkdown(remote);
      setMarkdown(normalizedRemote);

      if (onRemoteContentChange) {
        const remoteContent = {
          text: normalizedRemote,
          timestamp: Date.now(),
        };
        onRemoteContentChange(remoteContent);
      }
    },
    metadata: {
      documentId,
      userId,
      userEmail,
      title,
      tags,
      getContentSnapshot: contentSnapshotProvider,
      cursorUsername: username || undefined,
    },
    getCursorSnapshot: cursorSnapshot,
    onSyncStatusChange,
    onPersisted,
  });

  useEffect(() => {
    if (!onRealtimeConnectionChange) return;
    onRealtimeConnectionChange(Boolean(isConnected && roomId && !readOnly));
  }, [isConnected, onRealtimeConnectionChange, roomId, readOnly]);

  useEffect(() => {
    if (!onRegisterFlush) return;
    const register = (override?: FlushOverride) => {
      return (
        flushPendingChanges({
          markdown: override?.markdown,
          contentSnapshot: override?.content || null,
          title: override?.title,
          tags: override?.tags,
        }) ?? Promise.resolve()
      );
    };
    onRegisterFlush(register);
    return () => {
      onRegisterFlush(async () => {});
    };
  }, [flushPendingChanges, onRegisterFlush]);

  const handleEditorReady = useCallback((element: HTMLDivElement | null) => {
    editorElementRef.current = element;
  }, []);

  // Handle markdown content change
  const handleMarkdownChange = useCallback((newMarkdown: string) => {
    // Normalize markdown to limit consecutive empty lines before syncing
    const normalizedMarkdown = normalizeMarkdown(newMarkdown);
    
    // NEVER emit or apply changes if offline - this prevents rollbacks
    if (isOffline) {
      // Just update local state and notify parent - no sync attempts
      setMarkdown(normalizedMarkdown);
      if (onContentChange) {
        onContentChange({
          text: normalizedMarkdown,
          timestamp: Date.now(),
        });
      }
      return;
    }
    
    // Emit to other clients if connected and has roomId (use normalized markdown)
    if (roomId && emitChange && isConnected) {
      emitChange(normalizedMarkdown);
    }
    
    // Also apply the change locally after a delay to normalize the markdown
    // This ensures the sender sees the same normalized markdown as receivers
    // The delay allows the markdown to be processed and normalized through the same path as remote updates
    // ONLY do this if connected - in offline mode, we apply immediately to prevent rollbacks
    if (roomId && isConnected && !isOffline) {
      setTimeout(() => {
        // Apply the normalized markdown locally to ensure it's normalized the same way
        // This will trigger the same normalization process as remote updates
        setMarkdown(normalizedMarkdown);
      }, 100);
    } else {
      // In offline mode, apply immediately to prevent rollbacks
      setMarkdown(normalizedMarkdown);
    }
    
    // Notify parent with the expected format (use normalized markdown)
    if (onContentChange) {
      onContentChange({
        text: normalizedMarkdown,
        timestamp: Date.now(),
      });
    }
  }, [onContentChange, emitChange, isConnected, roomId, isOffline, normalizeMarkdown]);

  // Handle formatting change
  const handleFormatChange = useCallback((command: string, value?: string) => {
    // Call the wysiwyg editor's formatting function
    if (window.applyWysiwygFormatting) {
      window.applyWysiwygFormatting(command, value);
    }
  }, []);

  // Handle debug toggle
  const handleToggleDebug = useCallback(() => {
    setDebugMode(prev => !prev);
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar - only show if not read-only */}
      {!readOnly && (
        <WysiwygToolbar
          onFormatChange={handleFormatChange}
          showDebug={debugMode}
          onToggleDebug={handleToggleDebug}
          onOpenSynthesis={onOpenSynthesis}
        />
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <WysiwygEditor
          content={markdown}
          onContentChange={readOnly ? () => {} : handleMarkdownChange}
          placeholder={placeholder}
          className="h-full"
          showDebug={debugMode}
          readOnly={readOnly}
          roomId={roomId}
          username={username || undefined}
          clientId={clientId}
          onEditorReady={handleEditorReady}
        />
      </div>
    </div>
  );
}
