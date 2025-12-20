"use client";

import Icon from "@/components/Icon";
import { cn } from "@/lib/utils";

type ViewMode = "new" | "history";

interface ViewModeSwitchProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewModeSwitch({ value, onChange }: ViewModeSwitchProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-muted rounded-lg border border-border">
      <button
        type="button"
        onClick={() => onChange("new")}
        className={cn(
          "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
          value === "new"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
        )}
        aria-pressed={value === "new"}
      >
        <span className="flex items-center justify-center gap-2">
          <Icon name="plus" className="w-4 h-4" />
          New request
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("history")}
        className={cn(
          "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
          value === "history"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
        )}
        aria-pressed={value === "history"}
      >
        <span className="flex items-center justify-center gap-2">
          <Icon name="clock" className="w-4 h-4" />
          My requests
        </span>
      </button>
    </div>
  );
}
