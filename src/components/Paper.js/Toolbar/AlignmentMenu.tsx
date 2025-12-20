"use client";
import { useState, useEffect } from "react";
import Icon from "@/components/Icon";

interface AlignmentMenuProps {
  onFormatChange: (command: string) => void;
}

export default function AlignmentMenu({ onFormatChange }: AlignmentMenuProps) {
  const [showAlignMenu, setShowAlignMenu] = useState(false);

  useEffect(() => {
    if (!showAlignMenu) return;
    const onDocMouse = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (target && !target.closest('[data-align-menu]')) {
        setShowAlignMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocMouse);
    return () => document.removeEventListener('mousedown', onDocMouse);
  }, [showAlignMenu]);

  return (
  <div className="relative inline-block" data-align-menu>
      <button
        type="button"
        onClick={() => setShowAlignMenu(!showAlignMenu)}
        className="p-2 rounded transition-colors bg-muted hover:bg-muted/80 text-foreground"
        title="Alignment"
      >
        <Icon name="align" className="h-5 w-5" />
      </button>

      {showAlignMenu && (
        <div className="absolute top-full left-1/2 mt-1 transform -translate-x-1/2 bg-card rounded shadow-lg border border-border z-50">
          <div className="py-1 flex flex-row">
            <button
              title="Align left"
              type="button"
              onClick={() => {
                onFormatChange('justifyLeft');
                setShowAlignMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
            >
              <Icon name="alignLeft" className="w-6 h-6" />
            </button>
            <button
              title="Center"
              type="button"
              onClick={() => {
                onFormatChange('justifyCenter');
                setShowAlignMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
            >
              <Icon name="alignCenter" className="w-6 h-6" />
            </button>
            <button
              title="Align right"
              type="button"
              onClick={() => {
                onFormatChange('justifyRight');
                setShowAlignMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
            >
              <Icon name="alignRight" className="w-6 h-6" />
            </button>
            <button
              title="Justify"
              type="button"
              onClick={() => {
                onFormatChange('justifyFull');
                setShowAlignMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
            >
              <Icon name="alignJustify" className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
