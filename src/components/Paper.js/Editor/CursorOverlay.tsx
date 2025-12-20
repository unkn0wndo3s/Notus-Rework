"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    const code = clientId.codePointAt(i);
    hash = (code ?? 0) + ((hash << 5) - hash);
  }
  
  // Generate a pastel color
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// Helper to find the text node and offset within it for a given global offset
function findTextNodeAtOffset(editor: HTMLDivElement, offset: number): { node: Node; nodeOffset: number } | null {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    let currentOffset = 0;

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            const nodeLength = node.textContent.length;
            if (currentOffset + nodeLength >= offset) {
                return { node, nodeOffset: offset - currentOffset };
            }
            currentOffset += nodeLength;
        }
    }
    return null;
}

// Calculate the (x, y) position from a text offset in the editor
// _version is used to trigger re-calc when DOM changes, even if unused in logic
function getPositionFromOffset(editor: HTMLDivElement, offset: number, _version?: number): { x: number; y: number } | null {
  try {
    // Ensure version usage to satisfy linter if strictly checked, though passing it is enough.
    // We can just ignore it, but accepting it makes the call site usage valid.
    
    if (!editor.hasChildNodes() || editor.textContent === '') {
      const computedStyle = globalThis.window.getComputedStyle(editor);
      const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
      const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
      return { x: paddingLeft, y: paddingTop };
    }

    // Try to find exact text node
    const found = findTextNodeAtOffset(editor, offset);
    let textNode = found?.node || null;
    let nodeOffset = found?.nodeOffset || 0;

    // Fallback if not found (end of text)
    if (!textNode) {
      const allTextNodes: Node[] = [];
      const textWalker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let node: Node | null;
      while ((node = textWalker.nextNode())) {
        allTextNodes.push(node);
      }
      
      if (allTextNodes.length > 0) {
        textNode = allTextNodes.at(-1) ?? null;
        nodeOffset = textNode?.textContent?.length || 0;
      } else {
        const editorRect = editor.getBoundingClientRect();
        const computedStyle = globalThis.window.getComputedStyle(editor);
        const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
        const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
        return { x: paddingLeft, y: paddingTop + editorRect.height - paddingTop * 2 };
      }
    }

    if (textNode && textNode.textContent !== null) {
      const safeOffset = Math.min(Math.max(0, nodeOffset), textNode.textContent.length);
      const range = document.createRange();
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
        } catch {
          // Fallback
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

// Helper to calculate updated offsets
function calculateUpdatedOffsets(
  remoteCursors: Map<string, RemoteCursor>,
  prevOffsets: Map<string, number>,
  oldText: string,
  newText: string
): Map<string, number> {
  const updated = new Map<string, number>();
  remoteCursors.forEach((cursor) => {
    const previousOffset = prevOffsets.has(cursor.clientId)
      ? (prevOffsets.get(cursor.clientId) as number) : cursor.offset;

    const newOffset = adjustCursorPositionForTextChange(oldText, newText, previousOffset);
    updated.set(cursor.clientId, newOffset);
  });
  return updated;
}

export default function CursorOverlay({ editorRef, remoteCursors }: Readonly<CursorOverlayProps>) {
  const [contentVersion, setContentVersion] = useState(0);
  const previousTextRef = useRef<string | null>(null);
  const mutationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Client-side adjusted offsets
  const [adjustedOffsets, setAdjustedOffsets] = useState<Map<string, number>>(() => new Map());

  // Extracted handler to reduce nesting
  const handleMutation = useCallback(() => {
    if (mutationTimeoutRef.current) clearTimeout(mutationTimeoutRef.current);
    mutationTimeoutRef.current = setTimeout(() => {
      setContentVersion((prev) => prev + 1);
    }, 50);
  }, []);

  // Use a callback ref or effect for mutation observer
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    
    const observer = new MutationObserver(handleMutation);
    observer.observe(editor, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (mutationTimeoutRef.current) clearTimeout(mutationTimeoutRef.current);
    };
  }, [editorRef, handleMutation]);

  // Adjust remote cursor offsets 
  useEffect(() => {
      if (!editorRef.current) return;
  
      const editor = editorRef.current;
      const newText = editor.textContent || "";
      const oldText = previousTextRef.current ?? newText;
  
      if (previousTextRef.current === null) {
        previousTextRef.current = newText;
        setAdjustedOffsets(() => {
          const initial = new Map<string, number>();
          remoteCursors.forEach((cursor) => {
            initial.set(cursor.clientId, cursor.offset);
          });
          return initial;
        });
        return;
      }
  
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
  
    setAdjustedOffsets((prev) => 
      calculateUpdatedOffsets(remoteCursors, prev, oldText, newText)
    );

    previousTextRef.current = newText;
  }, [contentVersion, editorRef, remoteCursors]);

  const cursorsWithPositions = useMemo(() => {
    if (!editorRef.current || remoteCursors.size === 0) return [];

    const editor = editorRef.current;
    const result: Array<{
      cursor: RemoteCursor;
      position: { x: number; y: number } | null;
      color: string;
    }> = [];

    remoteCursors.forEach((cursor) => {
      const effectiveOffset = adjustedOffsets.get(cursor.clientId) ?? cursor.offset;
      const position = editor ? getPositionFromOffset(editor, effectiveOffset, contentVersion) : null;
      const color = getColorForClientId(cursor.clientId);
      result.push({ cursor, position, color });
    });

    return result;
  }, [editorRef, remoteCursors, contentVersion, adjustedOffsets]);

  if (!editorRef.current || cursorsWithPositions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {cursorsWithPositions.map(({ cursor, position, color }) => {
        if (!position) return null;

        return (
          <div
            key={cursor.clientId}
            className="absolute z-50 text-white group"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              pointerEvents: 'auto',
            }}
          >
            {/* Username - shown on CSS hover */}
            <div
              className="hidden group-hover:block absolute bottom-full mb-1 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg pointer-events-none"
              style={{
                backgroundColor: color,
                transform: 'translateX(-50%)',
                left: '50%',
              }}
            >
              {cursor.username || 'User'}
            </div>
            
            {/* Cursor Bar */}
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

