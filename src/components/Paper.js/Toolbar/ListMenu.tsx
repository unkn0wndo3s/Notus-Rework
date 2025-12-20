"use client";
import { useState, useEffect } from "react";
import Icon from "@/components/Icon";

interface ListMenuProps {
  onFormatChange: (command: string) => void;
}

export default function ListMenu({ onFormatChange }: ListMenuProps) {
  const [showListMenu, setShowListMenu] = useState(false);
  const MENU_ID = 'listMenu';

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail !== MENU_ID) setShowListMenu(false);
    };
    window.addEventListener('wysiwyg:open-menu', handler as EventListener);
    return () => window.removeEventListener('wysiwyg:open-menu', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!showListMenu) return;
    const onDocMouse = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (target && !target.closest('[data-list-menu]')) setShowListMenu(false);
    };
    document.addEventListener('mousedown', onDocMouse);
    return () => document.removeEventListener('mousedown', onDocMouse);
  }, [showListMenu]);

  return (
    <div className="relative" data-list-menu>
      <button
        type="button"
        onClick={() => {
          const next = !showListMenu;
          setShowListMenu(next);
          if (next) window.dispatchEvent(new CustomEvent('wysiwyg:open-menu', { detail: MENU_ID }));
          else window.dispatchEvent(new CustomEvent('wysiwyg:open-menu', { detail: '' }));
        }}
        className="p-2 rounded transition-colors bg-muted hover:bg-muted/80 text-foreground"
        title="List"
      >
        <Icon name="list" className="h-5 w-5" />
      </button>

      {showListMenu && (
        <div className="absolute top-full left-0 mt-1 bg-card rounded shadow-lg border border-border z-50">
          <div className="py-1">
            <button
              title="Bulleted list"
              type="button"
              onClick={() => {
                onFormatChange('insertUnorderedList');
                setShowListMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
            >
              <Icon name="listBulleted" className="w-6 h-6" />
            </button>
            <button
              title="Numbered list"
              type="button"
              onClick={() => {
                onFormatChange('insertOrderedList');
                setShowListMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
            >
              <Icon name="listNumbered" className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
