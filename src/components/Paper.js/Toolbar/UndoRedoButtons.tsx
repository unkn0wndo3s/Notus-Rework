"use client";

import Icon from "@/components/Icon";

interface UndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  onFormatChange: (command: string) => void;
}

export default function UndoRedoButtons({ canUndo, canRedo, onFormatChange }: UndoRedoButtonsProps) {
  return (
    <>
      {/* Undo */}
      <button
        type="button"
        onClick={() => {
          if ((window as any).handleWysiwygUndo) {
            (window as any).handleWysiwygUndo();
          } else {
            onFormatChange('undo');
          }
        }}
        disabled={!canUndo}
        className={`p-2 rounded transition-colors ${
          canUndo
            ? "bg-muted hover:bg-muted/80 text-foreground"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
        title="Undo (Ctrl+Z)"
      >
        <Icon name="undo" className="h-5 w-5" />
      </button>

      {/* Redo */}
      <button
        type="button"
        onClick={() => {
          if ((window as any).handleWysiwygRedo) {
            (window as any).handleWysiwygRedo();
          } else {
            onFormatChange('redo');
          }
        }}
        disabled={!canRedo}
        className={`p-2 rounded transition-colors ${
          canRedo
            ? "bg-muted hover:bg-muted/80 text-foreground"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
        title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
      >
        <Icon name="redo" className="h-5 w-5" />
      </button>
    </>
  );
}
