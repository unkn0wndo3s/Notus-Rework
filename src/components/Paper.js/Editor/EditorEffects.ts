import { useEffect, useCallback, useRef } from "react";
import { MarkdownConverter } from "./MarkdownConverter";
import { FormattingHandler } from "./FormattingHandler";
import { adjustCursorPositionForTextChange } from "../../../lib/paper.js/cursorUtils";
import { sanitizeHtml, EDITOR_SANITIZE_CONFIG } from "@/lib/sanitizeHtml";

export interface EditorEffectsProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  markdown: string;
  markdownConverter: React.MutableRefObject<MarkdownConverter | null>;
  onContentChange: (content: string) => void;
  selectedElement: HTMLElement | null;
  setSelectedElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  setImageOverlayRect: React.Dispatch<React.SetStateAction<{ left: number; top: number; width: number; height: number } | null>>;
  formattingHandler: React.MutableRefObject<FormattingHandler | null>;
  debounceTimeout: React.MutableRefObject<NodeJS.Timeout | null>;
  handleEditorChange: () => void;
  isUpdatingFromMarkdown?: React.MutableRefObject<boolean>;
  isLocalChange?: React.MutableRefObject<boolean>;
}

function isImageElement(element: Element | null): element is HTMLImageElement {
  return typeof HTMLImageElement !== "undefined" && element instanceof HTMLImageElement;
}

export function useEditorEffects({
  editorRef,
  markdown,
  markdownConverter,
  onContentChange,
  selectedElement,
  setSelectedElement,
  setImageOverlayRect,
  formattingHandler,
  debounceTimeout,
  handleEditorChange,
  isUpdatingFromMarkdown,
  isLocalChange
}: Readonly<EditorEffectsProps>) {
  // Note: Initialization is handled in the main component
  const draggedAttachmentRef = useRef<HTMLElement | null>(null);

  // Initialize editor content once on mount and sync external changes
  useEffect(() => {
    const root = editorRef.current;
    if (!root || !markdown || !markdownConverter.current) return;

    // Always capture selection first, before any checks
    // This is important for collaborative editing to adjust cursor position
    const getSelectionOffsets = (container: HTMLElement): { start: number; end: number } | null => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      
      // Helper to check if a node is within the container
      const isNodeInContainer = (node: Node): boolean => {
        if (node === container) return true;
        if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
          return container.contains(node);
        }
        return false;
      };
      
      // Ensure selection belongs to this editor
      if (!isNodeInContainer(range.startContainer) || !isNodeInContainer(range.endContainer)) {
        return null;
      }

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let start = -1;
      let end = -1;
      let offset = 0;
      let node: Node | null = walker.nextNode();
      
      while (node) {
        const textLen = (node.textContent || '').length;
        if (node === range.startContainer) {
          start = offset + range.startOffset;
        }
        if (node === range.endContainer) {
          end = offset + range.endOffset;
        }
        // If we found both positions, we can break early
        if (start >= 0 && end >= 0) break;
        offset += textLen;
        node = walker.nextNode();
      }
      
      // If we didn't find the positions in text nodes, try a fallback
      if (start < 0 || end < 0) {
        // Fallback: calculate based on the range position relative to container
        try {
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(container);
          preCaretRange.setEnd(range.startContainer, range.startOffset);
          start = preCaretRange.toString().length;
          
          const preEndRange = range.cloneRange();
          preEndRange.selectNodeContents(container);
          preEndRange.setEnd(range.endContainer, range.endOffset);
          end = preEndRange.toString().length;
        } catch {
          return null;
        }
      }
      
      if (start < 0 || end < 0) return null;
      return { start, end };
    };

    // Helper to set selection offsets
    const setSelectionOffsets = (container: HTMLElement, selStart: number, selEnd: number) => {
      const totalLength = container.textContent ? container.textContent.length : 0;
      const clamp = (v: number) => Math.max(0, Math.min(v, totalLength));
      const targetStart = clamp(selStart);
      const targetEnd = clamp(selEnd);

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      let traversed = 0;

      const locate = (target: number): { node: Node; offset: number } => {
        let n: Node | null = node;
        let acc = traversed;
        while (n) {
          const len = (n.textContent || '').length;
          if (acc + len >= target) {
            return { node: n, offset: target - acc };
          }
          acc += len;
          n = walker.nextNode();
        }
        // fallback to end of container
        return { node: container, offset: container.childNodes.length } as { node: Node; offset: number };
      };

      const startPos = locate(targetStart);
      // Reset walker to beginning to compute end separately
      const walker2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let acc2 = 0;
      let n2: Node | null = walker2.nextNode();
      while (n2) {
        const len = (n2.textContent || '').length;
        if (acc2 + len >= targetEnd) break;
        acc2 += len;
        n2 = walker2.nextNode();
      }
      const endPos = n2 ? { node: n2, offset: targetEnd - acc2 } : startPos;

      try {
        const sel = window.getSelection();
        if (!sel) return;
        const newRange = document.createRange();
        newRange.setStart(startPos.node, startPos.offset);
        newRange.setEnd(endPos.node, endPos.offset);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } catch {
        // ignore restoration errors
      }
    };

    let cancelled = false;

    const runConversion = async () => {
      const currentRoot = editorRef.current;
      if (!currentRoot || cancelled) return;

      const prevSelection = getSelectionOffsets(currentRoot);
      const hasActiveSelection = prevSelection !== null;

      // Don't update HTML if this is a local change (user typing)
      // Check multiple times to handle race conditions
      if (isLocalChange?.current) {
        return;
      }

      let currentHtml: string;
      try {
        currentHtml = await markdownConverter.current!.markdownToHtml(markdown);
      } catch (error) {
        console.error('[MarkdownConverter] markdownToHtml failed', error);
        return;
      }
      const safeHtml = sanitizeHtml(currentHtml, EDITOR_SANITIZE_CONFIG);

      if (cancelled) return;
      const activeRoot = editorRef.current;
      if (!activeRoot) return;

      const editorHtml = activeRoot.innerHTML;

      // Only update if content is different to avoid infinite loops
      // Normalize HTML for comparison (remove extra whitespace, normalize attributes)
      const normalizeHtml = (html: string) => {
        // Create a temporary div to normalize the HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.innerHTML;
      };

      const normalizedCurrentHtml = normalizeHtml(safeHtml);
      const normalizedEditorHtml = normalizeHtml(editorHtml);
      
      if (normalizedCurrentHtml === normalizedEditorHtml) {
        // HTML is the same, but check markdown to be sure for collaborative editing
        try {
          const currentMarkdown = markdownConverter.current!.htmlToMarkdown(editorHtml);
          // Normalize both markdowns for comparison (trim whitespace, normalize line endings)
          const normalizedCurrent = currentMarkdown.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          const normalizedTarget = markdown.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          
          if (normalizedCurrent === normalizedTarget) {
            // The current HTML already represents the target markdown, no need to replace it
            return;
          }
        } catch (e) {
          // If conversion fails, proceed with update if HTML is different
          // (HTML might be different even if markdown comparison fails)
        }
      }
      
      // Final check before updating - if user started typing, don't overwrite
      if (isLocalChange?.current || cancelled) {
        return;
      }

      const oldTextContent = activeRoot.textContent || '';
      const newTextContent = (() => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = safeHtml;
        return tempDiv.textContent || '';
      })();

      // Check if text content actually changed - if not, don't update HTML or cursor
      const textContentChanged = oldTextContent !== newTextContent;
      
      // If text content is identical, don't update HTML to avoid cursor movement
      if (!textContentChanged && normalizedCurrentHtml === normalizedEditorHtml) {
        return;
      }

      // Apply new HTML
      // Mark that we're updating from markdown to avoid feedback loops
      if (isUpdatingFromMarkdown?.current !== undefined) {
        isUpdatingFromMarkdown.current = true;
      }
      if (!editorRef.current || cancelled) return;
      editorRef.current.innerHTML = safeHtml;

      // Only restore cursor if:
      // 1. There was an active selection AND
      // 2. The text content actually changed (for collaborative editing)
      if (hasActiveSelection && prevSelection && textContentChanged) {
        // Use requestAnimationFrame for better synchronization with DOM updates
        // Then use setTimeout to ensure the DOM is fully ready
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (cancelled) return;
            try {
              // Adjust cursor positions based on text changes
              // This ensures that when another user adds/removes text, the cursor
              // position is adjusted accordingly (shifted right if text is added before,
              // shifted left if text is removed before)
              const adjustedStart = adjustCursorPositionForTextChange(oldTextContent, newTextContent, prevSelection.start);
              const adjustedEnd = adjustCursorPositionForTextChange(oldTextContent, newTextContent, prevSelection.end);
              
              // Debug logging (can be removed in production)
              console.log('🔄 Cursor adjustment:', {
                oldTextLength: oldTextContent.length,
                newTextLength: newTextContent.length,
                oldCursor: prevSelection.start,
                adjustedCursor: adjustedStart,
                delta: adjustedStart - prevSelection.start,
                oldText: oldTextContent.substring(Math.max(0, prevSelection.start - 10), prevSelection.start + 10),
                newText: newTextContent.substring(Math.max(0, adjustedStart - 10), adjustedStart + 10)
              });
              
              setSelectionOffsets(editorRef.current!, adjustedStart, adjustedEnd);
              // Ensure the editor maintains focus if it had it before
              const currentNode = editorRef.current;
              if (!currentNode) return;
              const isFocused = document.activeElement === currentNode || currentNode.contains(document.activeElement as Node);
              if (!isFocused) {
                // Try to restore focus if the selection was active (user was typing)
                // This helps maintain the cursor position during collaborative editing
                currentNode.focus();
              }
            } catch (e) {
              // If restoration fails, try a simpler approach: place cursor at the end
              try {
                const sel = window.getSelection();
                const currentNode = editorRef.current;
                if (sel && currentNode) {
                  const range = document.createRange();
                  range.selectNodeContents(currentNode);
                  range.collapse(false); // Collapse to end
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
              } catch {
                // Ignore errors
              }
            }
          }, 10); // Small delay to ensure DOM is ready
        });
      }
      // Clear the flag after update
      setTimeout(() => {
        if (isUpdatingFromMarkdown?.current !== undefined) {
          isUpdatingFromMarkdown.current = false;
        }
      }, 0);
    };

    runConversion();

    return () => {
      cancelled = true;
    };
  }, [markdown, editorRef, markdownConverter, isUpdatingFromMarkdown, isLocalChange]);

  // Keep overlay in sync on scroll/resize/content changes
  useEffect(() => {
    const updateOverlay = () => {
      if (!selectedElement || !editorRef.current) return;
      const imgRect = selectedElement.getBoundingClientRect();
      const contRect = editorRef.current.getBoundingClientRect();
      setImageOverlayRect({
        left: imgRect.left - contRect.left,
        top: imgRect.top - contRect.top,
        width: imgRect.width,
        height: imgRect.height,
      });
    };
    updateOverlay();
    window.addEventListener('scroll', updateOverlay, true);
    window.addEventListener('resize', updateOverlay);
    const interval = setInterval(updateOverlay, 250);
    return () => {
      window.removeEventListener('scroll', updateOverlay, true);
      window.removeEventListener('resize', updateOverlay);
      clearInterval(interval);
    };
  }, [selectedElement, editorRef, setImageOverlayRect]);

  // Expose functions to parent
  useEffect(() => {
    if (formattingHandler.current) {
      window.applyWysiwygFormatting = (command: string, value?: string) => {
        console.log('applyWysiwygFormatting called with command:', command, 'value:', value);
        formattingHandler.current?.applyFormatting(command, value);
      };
      console.log('applyWysiwygFormatting exposed on window');
    } else {
      console.log('formattingHandler.current is null, cannot expose applyWysiwygFormatting');
    }
  }, [formattingHandler]);

  // Handle inline file downloads and protect attachment blocks
  useEffect(() => {
    const updateOverlayForElement = (element: HTMLElement) => {
      if (!editorRef.current) return;
      const elemRect = element.getBoundingClientRect();
      const contRect = editorRef.current.getBoundingClientRect();
      setImageOverlayRect({
        left: elemRect.left - contRect.left,
        top: elemRect.top - contRect.top,
        width: elemRect.width,
        height: elemRect.height,
      });
    };

    const handleFileClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const fileContainer = target.closest('.wysiwyg-file-attachment') as HTMLElement | null;
      const isLinkClick = target.classList.contains('wysiwyg-file-link');
      const fileLink = isLinkClick
        ? (target as HTMLElement)
        : (fileContainer?.querySelector('.wysiwyg-file-link') as HTMLElement | null);

      if (!fileContainer && !fileLink) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (fileContainer) {
        const allFiles = editorRef.current?.querySelectorAll('.wysiwyg-file-attachment[data-selected-file="true"]');
        allFiles?.forEach((file) => file.removeAttribute('data-selected-file'));
        fileContainer.setAttribute('data-selected-file', 'true');
        setSelectedElement(fileContainer);
        updateOverlayForElement(fileContainer);
        if (!isLinkClick) {
          return;
        }
      }

      const sourceElement = fileLink || fileContainer;
      if (!sourceElement) return;
      setSelectedElement(sourceElement);
      updateOverlayForElement(sourceElement);

      const fileName =
        sourceElement.getAttribute('data-file-name') ||
        fileContainer?.getAttribute('data-file-name') ||
        'file';
      const fileData =
        sourceElement.getAttribute('data-file-data') ||
        fileContainer?.getAttribute('data-file-data');

      if (!fileData || !fileData.startsWith('data:')) {
        console.warn('No valid file data for download');
        return;
      }

      const link = document.createElement('a');
      link.href = fileData;
      link.download = fileName;
      link.click();
    };

    // Completely prevent editing of attachment file names
    const preventFileEdit = (e: Event) => {
      const target = e.target as HTMLElement;
      const fileContainer = target.closest('.wysiwyg-file-attachment') as HTMLElement;
      if (fileContainer) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Immediately restore file name
        const fileName = fileContainer.getAttribute('data-file-name');
        const fileLink = fileContainer.querySelector('.wysiwyg-file-link') as HTMLElement;
        if (fileName && fileLink) {
          fileLink.textContent = fileName;
        }
        // Prevent focus on file elements
        if (document.activeElement && fileContainer.contains(document.activeElement)) {
          (document.activeElement as HTMLElement).blur();
        }
        return false;
      }
    };

    // Prevent focus on attachments
    const preventFileFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const fileContainer = target.closest('.wysiwyg-file-attachment') as HTMLElement;
      if (fileContainer) {
        e.preventDefault();
        e.stopPropagation();
        (target as HTMLElement).blur();
        // Move cursor after file
        const selection = window.getSelection();
        if (selection && fileContainer.parentNode) {
          const range = document.createRange();
          range.setStartAfter(fileContainer);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        return false;
      }
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('click', handleFileClick);
      
      // Completely prevent editing of attachments
      editor.addEventListener('beforeinput', preventFileEdit, true); // capture phase
      editor.addEventListener('input', preventFileEdit, true);
      editor.addEventListener('focusin', preventFileFocus, true);
      editor.addEventListener('focus', preventFileFocus, true);
      
      // Prevent all keys in attachments
      editor.addEventListener('keydown', (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const fileContainer = target.closest('.wysiwyg-file-attachment') as HTMLElement;
        if (fileContainer) {
          // Only allow Delete/Backspace to delete the entire file (if selected)
          if (e.key === 'Delete' || e.key === 'Backspace') {
            // Check if file is selected, otherwise prevent
            if (!fileContainer.hasAttribute('data-selected-file')) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              return false;
            }
          } else {
            // Prevent any other key
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
        }
      }, true); // capture phase
      
      // Monitor content changes and immediately restore name
      const restoreFileName = () => {
        if (!editorRef.current) return;
        const fileContainers = editorRef.current.querySelectorAll('.wysiwyg-file-attachment');
        fileContainers.forEach((container) => {
          const fileContainer = container as HTMLElement;
          const fileName = fileContainer.getAttribute('data-file-name');
          const fileLink = fileContainer.querySelector('.wysiwyg-file-link') as HTMLElement;
          if (fileName && fileLink) {
            // Force content to be exactly the file name
            if (fileLink.textContent !== fileName) {
              fileLink.textContent = fileName;
            }
            // Ensure contenteditable is false
            fileLink.setAttribute('contenteditable', 'false');
            fileContainer.setAttribute('contenteditable', 'false');
          }
        });
      };
      
      const observer = new MutationObserver((mutations) => {
        let shouldRestore = false;
        mutations.forEach((mutation) => {
          if (mutation.type === 'characterData' || mutation.type === 'childList') {
            const target = mutation.target as HTMLElement;
            if (target.closest?.('.wysiwyg-file-attachment')) {
              shouldRestore = true;
            }
            if (mutation.addedNodes) {
              Array.from(mutation.addedNodes).forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE && node.parentElement?.closest('.wysiwyg-file-attachment')) {
                  shouldRestore = true;
                }
              });
            }
          }
        });
        
        if (shouldRestore) {
          restoreFileName();
        }
      });
      observer.observe(editor, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['contenteditable'] });
      
      setTimeout(() => {
        restoreFileName();
      }, 100);
      
      return () => {
        editor.removeEventListener('click', handleFileClick);
        editor.removeEventListener('beforeinput', preventFileEdit);
        editor.removeEventListener('input', preventFileEdit);
        editor.removeEventListener('focusin', preventFileFocus);
        editor.removeEventListener('focus', preventFileFocus);
        observer.disconnect();
      };
    }
  }, [editorRef, setSelectedElement, setImageOverlayRect]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    const ensureDraggableAttachments = () => {
      const selector = 'img[data-file-name], video[data-file-name], .wysiwyg-file-attachment';
      root.querySelectorAll(selector).forEach((node) => {
        const element = node as HTMLElement;
        element.setAttribute('draggable', 'true');
        element.setAttribute('data-draggable-attachment', 'true');
      });
    };

    const getRangeFromPoint = (x: number, y: number): Range | null => {
      if (document.caretRangeFromPoint) {
        return document.caretRangeFromPoint(x, y);
      }
      const caretPosition = document.caretPositionFromPoint?.(x, y);
      if (caretPosition) {
        const range = document.createRange();
        range.setStart(caretPosition.offsetNode, caretPosition.offset);
        range.collapse(true);
        return range;
      }
      return null;
    };

    const handleDragStart = (event: DragEvent) => {
      const target = event.target as HTMLElement | null;
      const attachment = target?.closest('[data-draggable-attachment="true"]') as HTMLElement | null;
      if (!attachment) return;
      draggedAttachmentRef.current = attachment;
      attachment.classList.add('wysiwyg-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData('text/plain', 'attachment');
        } catch (_e) {}
        try {
          event.dataTransfer.setDragImage(attachment, attachment.clientWidth / 2, attachment.clientHeight / 2);
        } catch (_e) {}
      }
    };

    const handleDragEnd = () => {
      if (draggedAttachmentRef.current) {
        draggedAttachmentRef.current.classList.remove('wysiwyg-dragging');
        draggedAttachmentRef.current = null;
      }
    };

    const handleDragOver = (event: DragEvent) => {
      if (!draggedAttachmentRef.current) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    };

    const handleDrop = (event: DragEvent) => {
      const attachment = draggedAttachmentRef.current;
      if (!attachment) return;
      event.preventDefault();
      const range = getRangeFromPoint(event.clientX, event.clientY);
      if (!range || !root.contains(range.commonAncestorContainer)) {
        handleDragEnd();
        return;
      }
      if (attachment.contains(range.commonAncestorContainer)) {
        handleDragEnd();
        return;
      }
      range.insertNode(attachment);
      range.setStartAfter(attachment);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      handleDragEnd();
      setTimeout(() => {
        handleEditorChange();
      }, 0);
    };

    ensureDraggableAttachments();
    const observer = new MutationObserver(() => ensureDraggableAttachments());
    observer.observe(root, { childList: true, subtree: true });

    root.addEventListener('dragstart', handleDragStart);
    root.addEventListener('dragend', handleDragEnd);
    root.addEventListener('dragover', handleDragOver);
    root.addEventListener('drop', handleDrop);

    return () => {
      observer.disconnect();
      root.removeEventListener('dragstart', handleDragStart);
      root.removeEventListener('dragend', handleDragEnd);
      root.removeEventListener('dragover', handleDragOver);
      root.removeEventListener('drop', handleDrop);
      handleDragEnd();
    };
  }, [editorRef, handleEditorChange]);

  // Helpers to edit currently selected image
  const applyImageEditInternal = useCallback((payload: { src?: string; widthPercent?: number; widthPx?: number }) => {
    if (!editorRef.current || !selectedElement || !isImageElement(selectedElement)) return false;
    const img = selectedElement;
    if (payload.src) {
      try {
        img.src = payload.src;
      } catch (_e) {
        // ignore
      }
    }
    if (typeof payload.widthPercent === 'number' && !Number.isNaN(payload.widthPercent)) {
      img.style.width = `${Math.max(1, Math.min(100, payload.widthPercent))}%`;
      img.style.maxWidth = '';
      img.style.height = 'auto';
    } else if (typeof payload.widthPx === 'number' && !Number.isNaN(payload.widthPx)) {
      img.style.width = `${Math.max(1, payload.widthPx)}px`;
      img.style.maxWidth = '';
      img.style.height = 'auto';
    }
    // sync markdown
    setTimeout(() => {
      handleEditorChange();
    }, 0);
    return true;
  }, [handleEditorChange, selectedElement, editorRef]);

  // Expose image helpers to toolbar
  useEffect(() => {
    window.getCurrentImageForEditing = () => {
      const img = selectedElement;
      if (!img || !isImageElement(img)) return null;
      return {
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        styleWidth: img.style.width || '',
        styleHeight: img.style.height || ''
      };
    };
    window.applyImageEdit = (payload: { src?: string; widthPercent?: number; widthPx?: number }) => {
      return applyImageEditInternal(payload);
    };
  }, [applyImageEditInternal, selectedElement]);

  // Cleanup timeout on unmount
  useEffect(() => {
    const timeoutRef = debounceTimeout.current;
    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    };
  }, [debounceTimeout]);
}
