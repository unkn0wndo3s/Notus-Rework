"use client";

import Icon from "@/components/Icon";
interface FormatButtonsProps {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  onFormatChange: (command: string) => void;
}

export default function FormatButtons({ 
  isBold, 
  isItalic, 
  isUnderline, 
  isStrikethrough, 
  onFormatChange 
}: FormatButtonsProps) {
  return (
    <>
      {/* Bold */}
      <button
        type="button"
        onClick={() => onFormatChange('bold')}
        className={`p-2 rounded transition-colors ${
          isBold
            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
            : "bg-muted hover:bg-muted/80 text-foreground"
        }`}
        title="Bold (Ctrl+B)"
      >
        <Icon name="bold" className="h-5 w-5" />
      </button>

      {/* Italic */}
      <button
        type="button"
        onClick={() => onFormatChange('italic')}
        className={`p-2 rounded transition-colors ${
          isItalic
            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
            : "bg-muted hover:bg-muted/80 text-foreground"
        }`}
        title="Italic (Ctrl+I)"
      >
        <Icon name="italic" className="h-5 w-5" />
      </button>

      {/* Underline */}
      <button
        type="button"
        onClick={() => onFormatChange('underline')}
        className={`p-2 rounded transition-colors ${
          isUnderline
            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
            : "bg-muted hover:bg-muted/80 text-foreground"
        }`}
        title="Underline (Ctrl+U)"
      >
        <Icon name="underline" className="h-5 w-5" />
      </button>

      {/* Strikethrough */}
      <button
        type="button"
        onClick={() => onFormatChange('strikeThrough')}
        className={`p-2 rounded transition-colors ${
          isStrikethrough
            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
            : "bg-muted hover:bg-muted/80 text-foreground"
        }`}
        title="Strikethrough"
      >
        <Icon name="strikethrough" className="h-5 w-5" />
      </button>
    </>
  );
}
