"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";

interface LinkPopupProps {
  visible: boolean;
  x: number;
  y: number;
  url: string;
  onClose: () => void;
}

export default function LinkPopup({ visible, x, y, url, onClose }: Readonly<LinkPopupProps>) {
  const popupTimeout = useRef<NodeJS.Timeout | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const sanitizeHref = useCallback((href: string) => {
    if (!href) return "";
    let cleaned = href.replaceAll(/%3C\/?em%3E/gi, "_").replaceAll(/<\/?em>/gi, "_");
    try {
      const decoded = decodeURIComponent(cleaned);
      cleaned = decoded.replaceAll(/<\/?em>/gi, "_");
    } catch (err) {
      console.error("LinkPopup: error decoding URI component", err);
    }
    return cleaned;
  }, []);

  const safeUrl = useMemo(() => sanitizeHref(url), [url, sanitizeHref]);

  const trustedOrigin = useMemo(() => {
    // Prefer explicit NEXT_PUBLIC_, fallback to NEXTAUTH_URL if exposed, else current origin
    if (globalThis.window === undefined) return "";
    const envOrigin =
      process.env.NEXT_PUBLIC_NEXTAUTH_URL ||
      process.env.NEXTAUTH_URL ||
      globalThis.window.location.origin;
    try {
      return new URL(envOrigin).origin;
    } catch (err) {
      return globalThis.window.location.origin;
    }
  }, []);

  const isTrustedUrl = useCallback(
    (target: string) => {
      try {
        const parsed = new URL(target || safeUrl, globalThis.window.location.href);
        return parsed.origin === trustedOrigin;
      } catch (err) {
        console.error("LinkPopup: error parsing URL", err);
        return false;
      }
    },
    [trustedOrigin, safeUrl]
  );

  // Handle popup mouse enter to keep it open
  const handlePopupEnter = useCallback(() => {
    // Clear any existing timeout to keep popup open
    if (popupTimeout.current) {
      clearTimeout(popupTimeout.current);
      popupTimeout.current = null;
    }
  }, []);

  // Handle popup mouse leave to hide popup
  const handlePopupLeave = useCallback((e: React.MouseEvent) => {
    // If the confirmation modal is open, never auto-close the popup
    if (showConfirm) return;

    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToLink = relatedTarget?.closest('a');
    
    // Only hide if not moving back to a link
    if (!isMovingToLink) {
      // Clear any existing timeout
      if (popupTimeout.current) {
        clearTimeout(popupTimeout.current);
      }
      
      // Hide popup after 1 second
      popupTimeout.current = setTimeout(() => {
        onClose();
      }, 1000);
    }
  }, [onClose, showConfirm]);

  // Open link in new tab
  const openLink = useCallback((url: string) => {
    // Clear any existing timeout
    if (popupTimeout.current) {
      clearTimeout(popupTimeout.current);
      popupTimeout.current = null;
    }

    const target = sanitizeHref(url);

    if (isTrustedUrl(target)) {
      window.open(target, '_blank', 'noopener,noreferrer');
      onClose();
    } else {
      setShowConfirm(true);
    }
  }, [onClose, isTrustedUrl, sanitizeHref]);

  const handleContinue = useCallback(() => {
    const target = safeUrl;
    window.open(target, '_blank', 'noopener,noreferrer');
    setShowConfirm(false);
    onClose();
  }, [onClose, safeUrl]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
  }, []);

  // Hide popup when clicking outside (disabled while confirm dialog is open)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showConfirm) return;
      if (visible) {
        const target = e.target as HTMLElement;
        if (!target.closest('a') && !target.closest('[data-link-popup]')) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose, showConfirm]);

  // Monitor cursor position to keep popup open when cursor is in link text
  useEffect(() => {
    const handleSelectionChange = () => {
      if (showConfirm) return;
      if (visible) {
        const selection = globalThis.window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const link = range.commonAncestorContainer.parentElement?.closest('a') || 
                      range.startContainer.parentElement?.closest('a');
          
          // If cursor is not in a link, hide popup
          if (!link) {
            onClose();
          }
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [visible, onClose, showConfirm]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (popupTimeout.current) {
        clearTimeout(popupTimeout.current);
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        data-link-popup
        className="absolute z-50 bg-card border border-border rounded-lg shadow-lg p-2 pointer-events-auto"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          transform: 'translateX(-50%)',
          minWidth: '120px'
        }}
        onMouseEnter={handlePopupEnter}
        onMouseLeave={handlePopupLeave}
      >
        <div className="flex items-center space-x-2">
          <span className="text-xs text-muted-foreground truncate max-w-32">
            {safeUrl}
          </span>
          <button
            type="button"
            onClick={() => openLink(safeUrl)}
            className="px-2 py-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded transition-colors"
          >
            Open
          </button>
        </div>
      </div>
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-4 space-y-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Are you sure?</h3>
              <p className="text-sm text-muted-foreground">
                This link leads to an external site that might not be secure. Do you want to continue?
              </p>
              <p className="text-xs text-muted-foreground break-all">{safeUrl}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-2 text-sm rounded border border-border bg-muted hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="px-3 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
