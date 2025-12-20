import { useCallback, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { MarkdownConverter } from "./MarkdownConverter";
import { FormattingHandler } from "./FormattingHandler";

export interface EditorEventHandlersProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  markdownConverter: React.MutableRefObject<MarkdownConverter | null>;
  isUpdatingFromMarkdown: React.MutableRefObject<boolean>;
  debounceTimeout: React.MutableRefObject<NodeJS.Timeout | null>;
  markdown: string;
  onContentChange: (content: string) => void;
  setLinkPopup: React.Dispatch<React.SetStateAction<{ visible: boolean; x: number; y: number; url: string }>>;
  setSelectedImage: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  setImageOverlayRect: React.Dispatch<React.SetStateAction<{ left: number; top: number; width: number; height: number } | null>>;
  selectedImage: HTMLElement | null;
  formattingHandler: React.MutableRefObject<FormattingHandler | null>;
  handleEditorChange: () => void;
}

export function useEditorEventHandlers({
  editorRef,
  markdownConverter,
  isUpdatingFromMarkdown,
  debounceTimeout,
  markdown,
  onContentChange,
  setLinkPopup,
  setSelectedImage,
  setImageOverlayRect,
  selectedImage,
  formattingHandler,
  handleEditorChange
}: EditorEventHandlersProps) {
  // Timer ref used to delay hiding the link popup to allow moving cursor to the popup
  const popupHideTimerRef = useRef<number | null>(null);
  
  // Handle content change in the editor - convert to markdown
  const handleEditorChangeCallback = useCallback((e?: React.FormEvent) => {
    if (!editorRef.current || !markdownConverter.current || isUpdatingFromMarkdown.current) return;
    
    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Convert to markdown when user stops typing (debounced)
    debounceTimeout.current = setTimeout(() => {
      // Double check that we're not in the middle of an update
      if (isUpdatingFromMarkdown.current) return;
      
      const newHtml = editorRef.current?.innerHTML;
      if (newHtml) {
        const newMarkdown = markdownConverter.current!.htmlToMarkdown(newHtml);
        
        // Only update if markdown has actually changed to avoid unnecessary re-renders
        if (markdown !== newMarkdown) {
          // Send the new markdown upward (parent will emit via socket)
          onContentChange(newMarkdown);
        }
      }
    }, 150);
  }, [onContentChange, markdown, editorRef, markdownConverter, isUpdatingFromMarkdown, debounceTimeout]);

  const sanitizeHref = useCallback((href: string | null | undefined) => {
    if (!href) return "";
    // First replace encoded patterns
    let cleaned = href.replaceAll(/%3C\/?em%3E/gi, "_");
    // Then replace literal tags
    cleaned = cleaned.replaceAll(/<\/?em>/gi, "_");
    // Try decoding and clean again
    try {
      const decoded = decodeURIComponent(cleaned);
      cleaned = decoded.replaceAll(/<\/?em>/gi, "_");
    } catch (error_) {
      // ignore decode errors
    }
    return cleaned;
  }, []);

  // Handle link hover to show popup
  const handleLinkHover = useCallback((e: React.MouseEvent) => {
    // Do not show the popup for file attachments
    const target = e.target as HTMLElement;
    if (target.closest('.wysiwyg-file-attachment')) {
      return;
    }
    
    // If there's a scheduled hide, cancel it because we're hovering a link now
    try {
      if (popupHideTimerRef.current) {
        clearTimeout(popupHideTimerRef.current);
        popupHideTimerRef.current = null;
      }
    } catch (_) {}
    const link = target.closest('a');
    if (link && editorRef.current) {
      const linkRect = link.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();
      
      // Calculate position relative to the editor container
      const x = linkRect.left - editorRect.left + (linkRect.width / 2);
      const y = linkRect.top - editorRect.top - 50; // Increased offset to position above the link
      
      setLinkPopup({
        visible: true,
        x: x,
        y: y,
        url: sanitizeHref(link.getAttribute('href'))
      });
    }
  }, [editorRef, setLinkPopup, sanitizeHref]);

  // Handle link mouse leave to hide popup
  const handleLinkLeave = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (link) {
      const relatedTarget = e.relatedTarget as HTMLElement;
      const isMovingToPopup = relatedTarget?.closest('[data-link-popup]');
      const isMovingToAnotherLink = relatedTarget?.closest('a');
      
      // Delay hiding slightly to allow the pointer to enter the popup
      if (!isMovingToPopup && !isMovingToAnotherLink) {
        try {
          if (popupHideTimerRef.current) clearTimeout(popupHideTimerRef.current);
        } catch (_) {}
        popupHideTimerRef.current = globalThis.window.setTimeout(() => {
          setLinkPopup(prev => ({ ...prev, visible: false }));
          popupHideTimerRef.current = null;
        }, 150) as unknown as number;
      }
    }
  }, [setLinkPopup]);

  // Clear any pending timer on unmount
  useEffect(() => {
    return () => {
      try {
        if (popupHideTimerRef.current) clearTimeout(popupHideTimerRef.current);
      } catch (error_) {}
    };
  }, []);

  const updateOverlayForElement = useCallback((element: HTMLElement) => {
    globalThis.window.requestAnimationFrame(() => {
      if (editorRef.current) {
        const elemRect = element.getBoundingClientRect();
        const contRect = editorRef.current.getBoundingClientRect();
        setImageOverlayRect({
          left: elemRect.left - contRect.left,
          top: elemRect.top - contRect.top,
          width: elemRect.width,
          height: elemRect.height,
        });
      }
    });
  }, [editorRef, setImageOverlayRect]);

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const img = target?.closest('img');
    const video = target?.closest('video');
    const attachment = target?.closest('.wysiwyg-file-attachment');
    
    // Allow selecting videos (for deletion)
    if (editorRef.current && video && editorRef.current.contains(video)) {
      if (selectedImage && selectedImage !== video) {
        delete (selectedImage as HTMLElement).dataset.selectedImage;
      }
      (video as HTMLVideoElement).dataset.selectedImage = 'true';
      setSelectedImage(video as HTMLVideoElement);
      updateOverlayForElement(video as HTMLVideoElement);
      return;
    }
    
    if (editorRef.current && img && editorRef.current.contains(img)) {
      if (selectedImage && selectedImage !== img) {
        delete (selectedImage as HTMLElement).dataset.selectedImage;
      }
      (img as HTMLImageElement).dataset.selectedImage = 'true';
      setSelectedImage(img as HTMLImageElement);
      updateOverlayForElement(img as HTMLImageElement);
    } else if (editorRef.current && attachment && editorRef.current.contains(attachment)) {
      if (selectedImage && selectedImage !== attachment && selectedImage instanceof HTMLElement) {
        delete selectedImage.dataset.selectedImage;
      }
      setSelectedImage(attachment as HTMLElement);
      updateOverlayForElement(attachment as HTMLElement);
    } else {
      if (selectedImage) {
        delete (selectedImage as HTMLElement).dataset.selectedImage;
      }
      setSelectedImage(null);
      setImageOverlayRect(null);
      try {
        const selectedFile = editorRef.current?.querySelector('.wysiwyg-file-attachment[data-selected-file="true"]') as HTMLElement | null;
        if (selectedFile) {
          delete selectedFile.dataset.selectedFile;
        }
      } catch (error_) {}
    }
  }, [selectedImage, editorRef, setSelectedImage, setImageOverlayRect, updateOverlayForElement]);

  // Handle dblclick to open image crop modal
  const handleEditorDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const img = target?.closest('img');
    const video = target?.closest('video');
    
    if (video) {
      return;
    }
    
    if (editorRef.current && img && editorRef.current.contains(img)) {
      if (selectedImage && selectedImage !== img) {
        delete (selectedImage as HTMLElement).dataset.selectedImage;
      }
      (img as HTMLImageElement).dataset.selectedImage = 'true';
      setSelectedImage(img as HTMLImageElement);
      try {
        const open = (window as any).openImageEditModal;
        if (typeof open === 'function') open();
      } catch (error_) {
        // no-op
      }
    }
  }, [selectedImage, editorRef, setSelectedImage]);

  // Handle paste events to clean up content
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Prevent pasting into file attachments
    const target = e.target as HTMLElement;
    if (target.closest('.wysiwyg-file-attachment')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.preventDefault();
    
    const clipboardData = e.clipboardData;
    const pastedData = clipboardData.getData('text/html') || clipboardData.getData('text/plain');
    
    if (pastedData) {
      try {
        // If current selection is inside a link, move caret after the link before inserting
        const sel = globalThis.window.getSelection();
        if (sel && sel.rangeCount > 0) {
          let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
          if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
          const el = node as Element | null;
          if (el) {
            // If we are in a file attachment, exit before pasting
            const fileContainer = el.closest('.wysiwyg-file-attachment');
            if (fileContainer && fileContainer.parentNode) {
              const newRange = document.createRange();
              newRange.setStartAfter(fileContainer);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
            } else {
              const anchor = el.closest && el.closest('a');
              if (anchor && anchor.parentNode) {
                const newRange = document.createRange();
                newRange.setStartAfter(anchor);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
              }
            }
          }
        }
      } catch (error_) {
        // ignore
      }
      // Clean the pasted content
      const cleanHtml = DOMPurify.sanitize(pastedData);
      globalThis.window.document.execCommand('insertHTML', false, cleanHtml);
      
      globalThis.window.setTimeout(() => {
        handleEditorChangeCallback();
      }, 0);
    }
  }, [handleEditorChangeCallback]);

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!formattingHandler.current) return;
    
    // Handle Ctrl+Z for undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      formattingHandler.current.applyFormatting('undo');
      return;
    }
    // Handle Redo
    if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      formattingHandler.current.applyFormatting('redo');
      return;
    }

    const sel = globalThis.window.getSelection();
    if (!sel || sel.rangeCount !== 1) return;
    const range = sel.getRangeAt(0);

    // Handle Deletion (Backspace or Delete)
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // 1. Handle selected media
      const selectedMedia = editorRef.current?.querySelector('[data-selected-image="true"]') as HTMLElement;
      if (selectedMedia && (selectedMedia.tagName === 'IMG' || selectedMedia.tagName === 'VIDEO')) {
        e.preventDefault();
        const brAfter = selectedMedia.nextSibling;
        selectedMedia.remove();
        if (brAfter && brAfter.nodeName === 'BR') brAfter.remove();
        setSelectedImage(null);
        setImageOverlayRect(null);
        setTimeout(() => {
          try { handleEditorChange(); } catch (error_) {}
        }, 0);
        return;
      }

      // 2. Handle selected file attachment
      const selectedFile = editorRef.current?.querySelector('.wysiwyg-file-attachment[data-selected-file="true"]') as HTMLElement;
      if (selectedFile) {
        e.preventDefault();
        selectedFile.remove();
        setTimeout(() => {
          try { handleEditorChange(); } catch (error_) {}
        }, 0);
        return;
      }

      // 3. Handle selection by range for file attachments
      if (!range.collapsed) {
        const ancestorNode = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;
        const fileContainer = ancestorNode instanceof Element
          ? (ancestorNode.closest('.wysiwyg-file-attachment') as HTMLElement | null)
          : null;
        if (fileContainer) {
          e.preventDefault();
          fileContainer.remove();
          setTimeout(() => {
            try { handleEditorChange(); } catch (error_) {}
          }, 0);
          return;
        }
      }

      // 4. Handle Backspace on empty paragraph (ZWSP)
      if (e.key === 'Backspace' && range.collapsed) {
        let node: Node | null = range.startContainer;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        const el = node as HTMLElement | null;
        const para = el?.closest ? (el.closest('p') || el.closest('div')) as HTMLElement | null : null;
        if (para) {
          const txt = para.textContent || '';
          if (txt === '\u200B' || txt === '\u200B\n' || txt.trim() === '\u200B') {
            e.preventDefault();
            const prev = para.previousElementSibling as HTMLElement | null;
            if (prev) {
              para.remove();
              const rng = document.createRange();
              const walker = document.createTreeWalker(prev, NodeFilter.SHOW_TEXT);
              let last: Node | null = null;
              let n = walker.nextNode();
              while (n) { last = n; n = walker.nextNode(); }
              if (last) {
                rng.setStart(last, (last.textContent || '').length);
                rng.collapse(true);
                sel.removeAllRanges();
                sel.addRange(rng);
              } else {
                rng.setStartAfter(prev);
                rng.collapse(true);
                sel.removeAllRanges();
                sel.addRange(rng);
              }
            } else {
              para.textContent = '';
              const rng = document.createRange();
              rng.selectNodeContents(para);
              rng.collapse(true);
              sel.removeAllRanges();
              sel.addRange(rng);
            }
            setTimeout(() => {
              if (editorRef.current && markdownConverter.current) {
                try {
                  const updatedHtml = editorRef.current.innerHTML;
                  const updatedMd = markdownConverter.current.htmlToMarkdown(updatedHtml);
                  onContentChange(updatedMd);
                } catch (error_) {
                  try { handleEditorChange(); } catch (error_2) {}
                }
              } else {
                try { handleEditorChange(); } catch (error_) {}
              }
            }, 0);
          }
        }
      }
    }
    // Handle Enter to preserve empty lines
    else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      setTimeout(() => {
        try {
          const sel_ = globalThis.window.getSelection();
          if (!sel_ || sel_.rangeCount === 0) return;
          const range_ = sel_.getRangeAt(0);
          let node_ = range_.startContainer;
          if (node_ && node_.nodeType === Node.TEXT_NODE) node_ = node_.parentElement || node_;
          const el_ = node_ as HTMLElement | null;
          const paragraph = el_?.closest ? (el_.closest('p') || el_.closest('div')) as HTMLElement | null : null;
          if (paragraph && (paragraph.textContent || '').trim() === '') {
            const zw = document.createTextNode('\u200B');
            paragraph.insertBefore(zw, paragraph.firstChild || null);
            const newRange = document.createRange();
            newRange.setStart(zw, 1);
            newRange.collapse(true);
            sel_.removeAllRanges();
            sel_.addRange(newRange);
            try { handleEditorChange(); } catch(error_) {}
          }
        } catch (error_) {}
      }, 0);
    }
    // Formatting Shortcuts
    else if (e.ctrlKey) {
      if (e.key === 'b') {
        e.preventDefault();
        formattingHandler.current.applyFormatting('bold');
      } else if (e.key === 'i') {
        e.preventDefault();
        formattingHandler.current.applyFormatting('italic');
      } else if (e.key === 'u') {
        e.preventDefault();
        formattingHandler.current.applyFormatting('underline');
      } else if (e.shiftKey && e.key === '.') {
        e.preventDefault();
        formattingHandler.current.applyFormatting('insertQuote');
      } else if (e.shiftKey && e.key === '-') {
        e.preventDefault();
        formattingHandler.current.applyFormatting('insertHorizontalRule');
      }
    }
  }, [formattingHandler, handleEditorChange, editorRef, markdownConverter, onContentChange, setSelectedImage, setImageOverlayRect]);

  return {
    handleEditorChange: handleEditorChangeCallback,
    handleLinkHover,
    handleLinkLeave,
    handleEditorClick,
    handleEditorDoubleClick,
    handlePaste,
    handleKeyDown
  };
}
