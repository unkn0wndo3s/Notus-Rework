"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { adjustCursorPositionForTextChange } from "../../../lib/paper.js/cursorUtils";

interface RemoteCursor {
  clientId: string;
  username: string;
  x: number;
  y: number;
  offset: number;
  lastUpdate: number;
}

interface CursorOverlayProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  remoteCursors: Map<string, RemoteCursor>;
}

// Generate a color based on the clientId for consistent colors
function getColorForClientId(clientId: string): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate a pastel color
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// Calculate the (x, y) position from a text offset in the editor
function getPositionFromOffset(editor: HTMLDivElement, offset: number): { x: number; y: number } | null {
  try {
    if (!editor.hasChildNodes() || editor.textContent === '') {
      const editorRect = editor.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(editor);
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
      return { x: paddingLeft, y: paddingTop };
    }

    const range = document.createRange();
    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let textNode: Node | null = null;
    let nodeOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const nodeLength = node.textContent.length;
        if (currentOffset + nodeLength >= offset) {
          textNode = node;
          nodeOffset = offset - currentOffset;
          break;
        }
        currentOffset += nodeLength;
      }
    }

    if (!textNode) {
      const allTextNodes: Node[] = [];
      const textWalker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        null
      );
      let node: Node | null;
      while ((node = textWalker.nextNode())) {
        allTextNodes.push(node);
      }
      
      if (allTextNodes.length > 0) {
        textNode = allTextNodes[allTextNodes.length - 1];
        nodeOffset = textNode.textContent?.length || 0;
      } else {
        const editorRect = editor.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(editor);
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        return { x: paddingLeft, y: paddingTop + editorRect.height - paddingTop * 2 };
      }
    }

    if (textNode && textNode.textContent !== null) {
      const safeOffset = Math.min(Math.max(0, nodeOffset), textNode.textContent.length);
      
      range.setStart(textNode, safeOffset);
      range.setEnd(textNode, safeOffset);

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
        } catch (e) {
          // Fallback: use a range to get the position of the text node
          const fallbackRange = document.createRange();
          fallbackRange.selectNodeContents(textNode);
          const nodeRect = fallbackRange.getBoundingClientRect();
          x = nodeRect.left - editorRect.left;
          y = nodeRect.top - editorRect.top;
        }
      }

      return { x, y };
    }
  } catch (e) {
    console.error('Error calculating cursor position:', e);
  }

  return null;
}

export default function CursorOverlay({ editorRef, remoteCursors }: CursorOverlayProps) {
  const [contentVersion, setContentVersion] = useState(0);
  const [hoveredCursor, setHoveredCursor] = useState<string | null>(null);
  const previousTextRef = useRef<string | null>(null);

  // Client-side adjusted offsets to account for local changes
  // (the original Map is not modified to remain pure)
  const [adjustedOffsets, setAdjustedOffsets] = useState<Map<string, number>>(
    () => new Map()
  );

  useEffect(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const observer = new MutationObserver(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        setContentVersion(prev => prev + 1);
      }, 50);
    });

    observer.observe(editor, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [editorRef]);

    // Adjust remote cursor offsets when the editor's text content changes.
    // This allows the position to follow correctly in our view if WE insert/delete text before a remote cursor.
    useEffect(() => {
      if (!editorRef.current) return;
  
      const editor = editorRef.current;
      const newText = editor.textContent || "";
      const oldText =
        previousTextRef.current !== null ? previousTextRef.current : newText;
  
      // First initialization: just record the current text
      if (previousTextRef.current === null) {
        previousTextRef.current = newText;
        // Initialize offsets with those received from the server
        setAdjustedOffsets(() => {
          const initial = new Map<string, number>();
          remoteCursors.forEach((cursor) => {
            initial.set(cursor.clientId, cursor.offset);
          });
          return initial;
        });
        return;
      }
  
      // If the text has not changed but the remoteCursors have changed,
      // we simply synchronize the offsets with those received from the server.
      // This avoids keeping an obsolete adjusted offset when the other
      // user moves their cursor without modifying the text.
      if (oldText === newText) {
        setAdjustedOffsets(() => {
          const synced = new Map<string, number>();
          remoteCursors.forEach((cursor) => {
            synced.set(cursor.clientId, cursor.offset);
          });
          return synced;
        });
        return;
      }
  
      // Adjust all cursors based on the oldText → newText difference
    setAdjustedOffsets((prev) => {
      const updated = new Map<string, number>();

      remoteCursors.forEach((cursor) => {
        const previousOffset = prev.has(cursor.clientId)
          ? (prev.get(cursor.clientId) as number)
          : cursor.offset;

        const newOffset = adjustCursorPositionForTextChange(
          oldText,
          newText,
          previousOffset
        );

        updated.set(cursor.clientId, newOffset);
      });

      return updated;
    });

    previousTextRef.current = newText;
  }, [contentVersion, editorRef, remoteCursors]);

  const cursorsWithPositions = useMemo(() => {
    if (!editorRef.current || remoteCursors.size === 0) {
      return [];
    }

    const editor = editorRef.current;
    const result: Array<{
      cursor: RemoteCursor;
      position: { x: number; y: number } | null;
      color: string;
    }> = [];

    remoteCursors.forEach((cursor) => {
      const effectiveOffset =
        adjustedOffsets.get(cursor.clientId) ?? cursor.offset;
      const position = editor
        ? getPositionFromOffset(editor, effectiveOffset)
        : null;
      const color = getColorForClientId(cursor.clientId);
      result.push({ cursor, position, color });
    });

    return result;
  }, [editorRef, remoteCursors, contentVersion, adjustedOffsets]);

  if (!editorRef.current || cursorsWithPositions.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {cursorsWithPositions.map(({ cursor, position, color }) => {
        if (!position) {
          return null;
        }

        const isHovered = hoveredCursor === cursor.clientId;

        return (
          <div
            key={cursor.clientId}
            className="absolute z-50"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              pointerEvents: 'auto',
            }}
            onMouseEnter={() => setHoveredCursor(cursor.clientId)}
            onMouseLeave={() => setHoveredCursor(null)}
          >
            {/* Username above - only shown on hover */}
            {isHovered && (
              <div
                className="absolute bottom-full mb-1 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg pointer-events-none"
                style={{
                  backgroundColor: color,
                  transform: 'translateX(-50%)',
                  left: '50%',
                }}
              >
                {cursor.username || 'User'}
              </div>
            )}
            
            {/* Barre verticale du curseur */}
            <div
              className="w-0.5 h-5 pointer-events-none"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 4px ${color}`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

