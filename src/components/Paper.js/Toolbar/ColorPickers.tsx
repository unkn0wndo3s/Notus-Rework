"use client";
import { useState, useEffect } from "react";
import Icon from "@/components/Icon";

interface ColorPickersProps {
  currentColor: string;
  currentHighlight: string;
  onFormatChange: (command: string, value: string) => void;
}

export default function ColorPickers({ currentColor, currentHighlight, onFormatChange }: ColorPickersProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // Handle clicks outside color pickers to close them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Check if click is outside color picker containers
      if (showColorPicker && !target.closest('[data-color-picker]')) {
        setShowColorPicker(false);
      }
      
      if (showHighlightPicker && !target.closest('[data-highlight-picker]')) {
        setShowHighlightPicker(false);
      }
    };

    if (showColorPicker || showHighlightPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker, showHighlightPicker]);

  return (
    <>
      {/* Text Color */}
      <div className="relative" data-color-picker>
        <button
          type="button"
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="p-2 rounded transition-colors bg-muted hover:bg-muted/80 text-foreground"
          title="Text color"
        >
          <Icon name="textColor" className="h-5 w-5" />
          <div 
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-1 rounded"
            style={{ backgroundColor: currentColor }}
          />
        </button>

        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-3 bg-card rounded shadow-lg border border-border z-50">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                Text color
              </label>
              <input
                type="color"
                value={currentColor}
                onChange={(e) => {
                  const color = e.target.value;
                  onFormatChange('foreColor', color);
                }}
                className="w-full h-10 rounded border border-border cursor-pointer"
                title="Select a color"
              />
              <button
                type="button"
                onClick={() => {
                  onFormatChange('foreColor', "#000000");
                  setShowColorPicker(false);
                }}
                className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded transition-colors"
              >
                Reset (Black)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Highlight Color */}
      <div className="relative" data-highlight-picker>
        <button
          type="button"
          onClick={() => setShowHighlightPicker(!showHighlightPicker)}
          className="p-2 rounded transition-colors bg-muted hover:bg-muted/80 text-foreground"
          title="Highlight color"
        >
          <Icon name="highlighter" className="h-5 w-5" />
          <div 
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-1 rounded"
            style={{ backgroundColor: currentHighlight === "transparent" ? "#ffff00" : currentHighlight }}
          />
        </button>

        {showHighlightPicker && (
          <div className="absolute top-full left-0 mt-1 p-3 bg-card rounded shadow-lg border border-border z-50">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                Highlight color
              </label>
              <input
                type="color"
                value={currentHighlight === "transparent" ? "#ffff00" : currentHighlight}
                onChange={(e) => {
                  const color = e.target.value;
                  onFormatChange('backColor', color);
                }}
                className="w-full h-10 rounded border border-border cursor-pointer"
                title="Select a highlight color"
              />
              <button
                type="button"
                onClick={() => {
                  onFormatChange('backColor', "transparent");
                  setShowHighlightPicker(false);
                }}
                className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded transition-colors"
              >
                Remove highlight
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
