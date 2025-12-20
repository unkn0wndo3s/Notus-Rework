"use client";
import { useState, useEffect } from "react";
import Icon from "@/components/Icon";

interface HeadingMenuProps {
  onFormatChange: (command: string, value: string) => void;
}

export default function HeadingMenu({ onFormatChange }: Readonly<HeadingMenuProps>) {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const MENU_ID = 'headingMenu';

  // Trigger the fontSize command twice to mimic a double click:
  // 1st pass can restore selection/focus, 2nd pass applies reliably.
  const applyFontSizeDouble = (size: string) => {
    try {
      onFormatChange('fontSize', size);
      // Use rAF to schedule after layout/selection restore
      if (globalThis.window !== undefined && typeof globalThis.window.requestAnimationFrame === 'function') {
        globalThis.window.requestAnimationFrame(() => onFormatChange('fontSize', size));
      } else {
        globalThis.window.setTimeout(() => onFormatChange('fontSize', size), 0);
      }
    } catch {
      // Fallback single apply if anything goes wrong
      onFormatChange('fontSize', size);
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail !== MENU_ID) setShowHeadingMenu(false);
    };
    globalThis.window.addEventListener('wysiwyg:open-menu', handler as EventListener);
    return () => globalThis.window.removeEventListener('wysiwyg:open-menu', handler as EventListener);
  }, []);

  // Close when clicking outside the heading menu
  useEffect(() => {
    if (!showHeadingMenu) return;
    const onDocMouse = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (target && !target.closest('[data-heading-menu]')) {
        setShowHeadingMenu(false);
        globalThis.window.dispatchEvent(new CustomEvent('wysiwyg:open-menu', { detail: '' }));
      }
    };
    document.addEventListener('mousedown', onDocMouse);
    return () => document.removeEventListener('mousedown', onDocMouse);
  }, [showHeadingMenu]);

  return (
    <div className="relative inline-block" data-heading-menu>
      <button
        type="button"
        onClick={() => {
          const next = !showHeadingMenu;
          setShowHeadingMenu(next);
          if (next) globalThis.window.dispatchEvent(new CustomEvent('wysiwyg:open-menu', { detail: MENU_ID }));
          else globalThis.window.dispatchEvent(new CustomEvent('wysiwyg:open-menu', { detail: '' }));
        }}
        className="p-2 rounded transition-colors bg-muted hover:bg-muted/80 text-foreground"
        title="Heading"
      >
        <Icon name="heading" className="w-5 h-5" />
      </button>

      {showHeadingMenu && (
        <div className="absolute top-full left-0 mt-1 bg-card rounded shadow-lg border border-border z-50 min-w-max">
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                applyFontSizeDouble('16px');
                setShowHeadingMenu(false);
              }}
              className="w-full px-4 py-2 text-sm hover:bg-muted flex items-center justify-between whitespace-nowrap"
            >
              16px - Normal
            </button>
            {[1, 2, 3, 4, 5, 6].map((level) => {
              const fontSizeMap: Record<number, string> = {
                1: '30px',
                2: '24px',
                3: '20px',
                4: '18px',
                5: '16px',
                6: '14px'
              };
              const fontSize = fontSizeMap[level];
              const labelMap: Record<number, string> = {
                1: '30px - Main title',
                2: '24px - Subtitle',
                3: '20px - Section title',
                4: '18px - Heading level 4',
                5: '16px - Heading level 5',
                6: '14px - Heading level 6'
              };
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    applyFontSizeDouble(fontSize);
                    setShowHeadingMenu(false);
                  }}
                  className="w-full px-4 py-2 text-sm hover:bg-muted flex items-center justify-between whitespace-nowrap"
                >
                  {labelMap[level]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
