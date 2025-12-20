"use client";

import { cn } from "@/lib/utils";
import Icon from "@/components/Icon";

interface FavoriteToggleProps {
  isFavorite: boolean;
  isAuthenticated: boolean;
  onToggleAuthenticated: (next: boolean) => void;
  className?: string;
  onRequireLogin?: () => void;
}

export default function FavoriteToggle({
  isFavorite,
  isAuthenticated,
  onToggleAuthenticated,
  className,
  onRequireLogin,
}: Readonly<FavoriteToggleProps>) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      try { onRequireLogin?.(); } catch {}
      return;
    }
    const next = !isFavorite;
    onToggleAuthenticated(next);
  };

  return (
    <button
        onClick={handleClick}
        onMouseDown={(e) => { e.stopPropagation(); }}
        onTouchStart={(e) => { e.stopPropagation(); }}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        className={cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors cursor-pointer",
          className
        )}
      >
        <Icon name={isFavorite ? "favoriteSolid" : "favorite"} className={isFavorite ? "text-primary hover:text-primary/70" : "text-muted-foreground hover:text-primary"} />
    </button>
  );
}


