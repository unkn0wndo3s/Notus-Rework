"use client";

import { COLOR_PALETTE, DEFAULT_COLOR } from "@/lib/colorPalette";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  className?: string;
}

export default function ColorPicker({ selectedColor, onColorChange, className }: Readonly<ColorPickerProps>) {
  const currentColor = selectedColor && /^#([0-9a-fA-F]{6})$/.test(selectedColor) ? selectedColor : DEFAULT_COLOR;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
        {COLOR_PALETTE.map((color) => {
          const isSelected = currentColor.toLowerCase() === color.value.toLowerCase();
          return (
            <button
              key={color.value}
              type="button"
              onClick={() => onColorChange(color.value)}
              aria-label={`Select color ${color.name}`}
              className={cn(
                "relative h-12 w-12 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isSelected
                  ? "border-foreground scale-110 shadow-lg ring-2 ring-primary"
                  : "border-border hover:scale-105 hover:shadow-md"
              )}
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 pt-2">
        <figure
          className="h-10 w-10 rounded-full border-2 border-border"
          style={{ backgroundColor: currentColor }}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {COLOR_PALETTE.find((c) => c.value.toLowerCase() === currentColor.toLowerCase())?.name || "Custom color"}
          </p>
          <p className="text-xs text-muted-foreground">{currentColor}</p>
        </div>
      </div>
    </div>
  );
}

