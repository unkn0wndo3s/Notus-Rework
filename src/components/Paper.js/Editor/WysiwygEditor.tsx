"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { MarkdownConverter } from "./MarkdownConverter";
import { FormattingHandler } from "./FormattingHandler";
import LinkPopup from "./LinkPopup";
import ImageOverlay from "./ImageOverlay";
import DebugPanel from "./DebugPanel";
import WysiwygEditorStyles from "./WysiwygEditorStyles";
import { useEditorEventHandlers } from "./EditorEventHandlers";
import { useEditorEffects } from "./EditorEffects";
import { useUndoRedoHistory } from "./useUndoRedoHistory";
import { useCursorTracking } from "@/lib/paper.js/useCursorTracking";
import CursorOverlay from "./CursorOverlay";
import { sanitizeHtml, EDITOR_SANITIZE_CONFIG } from "@/lib/sanitizeHtml";

interface WysiwygEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  showDebug?: boolean;
  readOnly?: boolean;
  roomId?: string;
  username?: string;
  clientId?: string;
  onEditorReady?: (element: HTMLDivElement | null) => void;
}

export default function WysiwygEditor({
  content,
  onContentChange,
  placeholder = "Start writing your document...",
  className = "",
  showDebug = false,
  readOnly = false,
  roomId,
  username,
  clientId,
  onEditorReady,
}: WysiwygEditorProps) {
  const [markdown, setMarkdown] = useState(content);
  
  const [linkPopup, setLinkPopup] = useState<{ visible: boolean; x: number; y: number; url: string }>({
    visible: false,
    x: 0,
    y: 0,
    url: ''
  });
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [imageOverlayRect, setImageOverlayRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isUpdatingFromMarkdown = useRef(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastSavedMarkdownRef = useRef<string>(content);
  const isLocalChangeRef = useRef<boolean>(false);
  
  const markdownConverter = useRef<MarkdownConverter | null>(null);
  const formattingHandler = useRef<FormattingHandler | null>(null);

  const setEditorHtml = (html: string) => {
    if (!editorRef.current) return;
    const safeHtml = sanitizeHtml(html, EDITOR_SANITIZE_CONFIG);
    editorRef.current.innerHTML = safeHtml;
  };

  useEffect(() => {
    if (onEditorReady) {
      onEditorReady(editorRef.current);
      return () => {
        onEditorReady(null);
      };
    }
  }, [onEditorReady]);

  // Generate clientId if not provided
  const clientIdRef = useRef<string>(clientId || (() => {
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  })());

  // Undo/Redo history
  const undoRedoHistory = useUndoRedoHistory(50);

  // Cursor tracking for collaborative editing
  const { remoteCursors } = useCursorTracking({
    roomId,
    editorRef,
    clientId: clientIdRef.current,
    username: username || 'User',
  });

  // Initialize history with initial content
  useEffect(() => {
    undoRedoHistory.initialize(content);
    lastSavedMarkdownRef.current = content;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Wrapper for onContentChange that also updates local markdown state for debug panel
  const handleContentChange = useCallback((newMarkdown: string, skipHistory: boolean = false) => {
    // Mark as local change to prevent EditorEffects from replacing HTML
    isLocalChangeRef.current = true;
    
    // Update local markdown state for debug panel
    setMarkdown(newMarkdown);
    
    // Save to history if content actually changed and we're not undoing/redoing
    if (!skipHistory && newMarkdown !== lastSavedMarkdownRef.current) {
      undoRedoHistory.saveState(newMarkdown);
      lastSavedMarkdownRef.current = newMarkdown;
    }
    
    // Call parent's onContentChange
    onContentChange(newMarkdown);
    
    // Reset flag after a longer delay to prevent race conditions with remote updates
    // This ensures that local typing is not overwritten by incoming updates
    setTimeout(() => {
      isLocalChangeRef.current = false;
    }, 300);
  }, [onContentChange, undoRedoHistory]);

  // Handle undo
  const handleUndo = useCallback(async () => {
    const previousMarkdown = undoRedoHistory.undo();
    if (previousMarkdown !== null && editorRef.current && markdownConverter.current) {
      isUpdatingFromMarkdown.current = true;
      const html = await markdownConverter.current.markdownToHtml(previousMarkdown);
      if (!editorRef.current) {
        isUpdatingFromMarkdown.current = false;
        return;
      }
      setEditorHtml(html);
      setMarkdown(previousMarkdown);
      lastSavedMarkdownRef.current = previousMarkdown;
      handleContentChange(previousMarkdown, true);
      
      // Restore cursor position
      setTimeout(() => {
        isUpdatingFromMarkdown.current = false;
        // Place cursor at end
        const sel = window.getSelection();
        if (sel && editorRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 0);
    }
  }, [undoRedoHistory, handleContentChange]);

  // Handle redo
  const handleRedo = useCallback(async () => {
    const nextMarkdown = undoRedoHistory.redo();
    if (nextMarkdown !== null && editorRef.current && markdownConverter.current) {
      isUpdatingFromMarkdown.current = true;
      const html = await markdownConverter.current.markdownToHtml(nextMarkdown);
      if (!editorRef.current) {
        isUpdatingFromMarkdown.current = false;
        return;
      }
      setEditorHtml(html);
      setMarkdown(nextMarkdown);
      lastSavedMarkdownRef.current = nextMarkdown;
      handleContentChange(nextMarkdown, true);
      
      // Restore cursor position
      setTimeout(() => {
        isUpdatingFromMarkdown.current = false;
        // Place cursor at end
        const sel = window.getSelection();
        if (sel && editorRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 0);
    }
  }, [undoRedoHistory, handleContentChange]);

  // Expose undo/redo functions globally
  useEffect(() => {
    window.handleWysiwygUndo = handleUndo;
    window.handleWysiwygRedo = handleRedo;
    window.canWysiwygUndo = () => undoRedoHistory.canUndo();
    window.canWysiwygRedo = () => undoRedoHistory.canRedo();
    
    return () => {
      delete window.handleWysiwygUndo;
      delete window.handleWysiwygRedo;
      delete window.canWysiwygUndo;
      delete window.canWysiwygRedo;
    };
  }, [handleUndo, handleRedo, undoRedoHistory]);

  // Initialize converter and handler
  useEffect(() => {
    markdownConverter.current = new MarkdownConverter();
    formattingHandler.current = new FormattingHandler(
      editorRef,
      (md: string) => handleContentChange(md, false),
      (html: string) => markdownConverter.current?.htmlToMarkdown(html) || ""
    );
  }, [handleContentChange]);

  // Update markdown when content prop changes (from remote updates)
  // Don't save remote updates to history
  useEffect(() => {
    // Don't update if this is a local change (user is typing)
    // But use a timeout to allow updates after typing stops
    if (isLocalChangeRef.current) {
      // Check again after a delay to allow remote updates to come through
      const timeoutId = setTimeout(() => {
        if (content !== markdown && content !== lastSavedMarkdownRef.current) {
          // Only update if we're not currently typing
          if (!isLocalChangeRef.current) {
            setMarkdown(content);
            lastSavedMarkdownRef.current = content;
          }
        }
      }, 350); // Wait a bit longer than the isLocalChange timeout (300ms)
      
      return () => clearTimeout(timeoutId);
    }
    
    if (content !== markdown && content !== lastSavedMarkdownRef.current) {
      setMarkdown(content);
      // Update history to reflect remote change, but don't add it as a new state
      // This keeps the history in sync with the actual content
      lastSavedMarkdownRef.current = content;
    }
  }, [content, markdown]);

  // Use custom hooks for event handlers and effects
  const eventHandlers = useEditorEventHandlers({
    editorRef,
    markdownConverter,
    isUpdatingFromMarkdown,
    debounceTimeout,
    markdown,
    onContentChange: handleContentChange,
    setLinkPopup,
    setSelectedImage: setSelectedElement,
    setImageOverlayRect,
    selectedImage: selectedElement,
    formattingHandler,
    handleEditorChange: () => {}
  });

  useEditorEffects({
    editorRef,
    markdown,
    markdownConverter,
    onContentChange: handleContentChange,
    selectedElement,
    setSelectedElement,
    setImageOverlayRect,
    formattingHandler,
    debounceTimeout,
    handleEditorChange: eventHandlers.handleEditorChange,
    isUpdatingFromMarkdown,
    isLocalChange: isLocalChangeRef
  });

  return (
    <div className={`${className}`}>
      <WysiwygEditorStyles />
      <div className="flex relative select-none">
        {/* Editor */}
        <div className={`flex flex-col relative w-full`}>
          {showDebug && (
            <div className="bg-muted px-3 py-2 border-b border-border">
              <span className="text-sm font-medium text-foreground">WYSIWYG Editor</span>
            </div>
          )}
          <div className="flex-1 relative">
            <div
              ref={editorRef}
              contentEditable={!readOnly}
              onInput={readOnly ? undefined : eventHandlers.handleEditorChange}
              onPaste={readOnly ? undefined : eventHandlers.handlePaste}
              onKeyDown={readOnly ? undefined : eventHandlers.handleKeyDown}
              onMouseOver={eventHandlers.handleLinkHover}
              onMouseOut={eventHandlers.handleLinkLeave}
              onDoubleClick={readOnly ? undefined : eventHandlers.handleEditorDoubleClick}
              className={`wysiwyg-editor ${showDebug ? 'flex-1' : 'w-full'} p-4 border-0 resize-none focus:outline-none bg-card text-foreground prose prose-sm max-w-none prose-a:text-primary prose-a:underline`}
              style={{ 
                minHeight: '200px', 
                maxHeight: 'none',
                // Specific styles for lists
                '--tw-prose-ul': 'list-style-type: disc; margin: 1rem 0; padding-left: 1.5rem;',
                '--tw-prose-ol': 'list-style-type: decimal; margin: 1rem 0; padding-left: 1.5rem;',
                '--tw-prose-li': 'margin: 0.25rem 0; display: list-item; list-style-position: outside;'
              } as React.CSSProperties}
              data-placeholder={placeholder}
              data-wysiwyg-editor-root="true"
              onClick={eventHandlers.handleEditorClick}
            />
            
            {/* Cursor overlay for collaborative editing */}
            {roomId && !readOnly && (
              <CursorOverlay 
                editorRef={editorRef}
                remoteCursors={remoteCursors}
              />
            )}
            
            {/* Inline image resize handle overlay */}
            <ImageOverlay 
              imageOverlayRect={imageOverlayRect}
              selectedElement={selectedElement}
              editorRef={editorRef}
              onElementResize={(newWidthPercent) => {
                if (selectedElement) {
                  selectedElement.style.width = `${newWidthPercent}%`;
                  if (selectedElement.tagName === 'IMG' || selectedElement.tagName === 'VIDEO') {
                    (selectedElement as HTMLElement).style.height = 'auto';
                  }
                  setTimeout(() => eventHandlers.handleEditorChange(), 0);
                }
              }}
            />
          </div>
        </div>

        {/* Debug Panel */}
        <DebugPanel 
          showDebug={showDebug} 
          markdown={markdown}
          editorRef={editorRef}
          markdownConverter={markdownConverter.current}
        />
        
        {/* Link Popup */}
        <LinkPopup 
          visible={linkPopup.visible}
          x={linkPopup.x}
          y={linkPopup.y}
          url={linkPopup.url}
          onClose={() => setLinkPopup(prev => ({ ...prev, visible: false }))}
        />
      </div>
    </div>
  );
}