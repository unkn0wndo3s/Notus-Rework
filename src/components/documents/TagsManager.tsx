"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import LoginRequiredModal from "@/components/auth/LoginRequiredModal";
import { useSearch } from "@/contexts/SearchContext";
import { useTagsContext } from "@/contexts/TagsContext";
import Icon from "@/components/Icon";

interface TagsManagerProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
  disabled?: boolean;
  currentUserId?: string | number | null;
  requireAuth?: boolean;
}

export default function TagsManager({
  tags,
  onTagsChange,
  placeholder = "Add tag...",
  maxTags = 20,
  className = "",
  disabled = false,
  currentUserId,
  requireAuth = false,
}: Readonly<TagsManagerProps>) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { filterByTag } = useSearch();
  const { getSuggestedTag } = useTagsContext();
  const suggested = newTag.trim() ? getSuggestedTag(newTag, tags) : null;

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    const trimmedTag = newTag.trim();
    const isValidTag = trimmedTag.length > 0 && trimmedTag.length <= 50 && !tags.includes(trimmedTag) && tags.length < maxTags;
    setIsValid(isValidTag);
  }, [newTag, tags, maxTags]);

  const addTag = () => {
    if (disabled) return;
    if (requireAuth && !currentUserId) { setShowLoginModal(true); return; }
    const trimmedTag = newTag.trim();
    if (isValid && trimmedTag) { onTagsChange([...tags, trimmedTag]); setNewTag(""); setIsAdding(false); }
  };

  const removeTag = (tagToRemove: string) => {
    if (disabled) return;
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) { e.preventDefault(); addTag(); }
    else if (e.key === "Escape") { setIsAdding(false); setNewTag(""); }
  };

  const startAdding = () => {
    if (disabled) return;
    if (requireAuth && !currentUserId) { setShowLoginModal(true); return; }
    setIsAdding(true);
  };

  const cancelAdding = () => { setIsAdding(false); setNewTag(""); };

  return (
    <div className={`w-full scroller ${className} ${disabled ? 'opacity-50' : ''}`}>
      <div ref={scrollContainerRef} className="flex items-center gap-2 px-1 overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent pb-1 max-w-full" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}>
        {isAdding && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="relative">
              <Input ref={inputRef} value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={placeholder} className={`h-7 text-sm w-32 ${isValid ? "" : "border-none"}`} onKeyDown={(e) => { if (e.key === "Tab" || e.key === "ArrowRight") { if (suggested) { e.preventDefault(); setNewTag(suggested); return; } } handleKeyDown(e); }} />
              {suggested && suggested.toLowerCase().startsWith(newTag.trim().toLowerCase()) && suggested.toLowerCase() !== newTag.trim().toLowerCase() && (
                <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-sm">
                  <span className="invisible">{newTag}</span>
                  <span className="text-muted-foreground/60">{suggested.slice(newTag.length)}</span>
                </div>
              )}
            </div>
            <Button variant="primary" size="icon-sm" onClick={addTag} disabled={!isValid} className="bg-primary hover:bg-primary/90 disabled:opacity-50" aria-label="Confirm adding tag">
              <Icon name="check" className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={cancelAdding} className="text-muted-foreground hover:text-foreground" aria-label="Cancel adding tag">
              <Icon name="x" className="h-4 w-4" />
            </Button>
          </div>
        )}
        {!isAdding && (
          <Button variant="secondary" size="icon-sm" onClick={startAdding} className="flex-shrink-0 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20" aria-label="Add tag">
            <Icon name="tagPlus" className="h-4 w-4" />
          </Button>
        )}
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="purple"
            size="md"
            className="flex-shrink-0 pr-1 group cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              filterByTag(tag);
            }}
            title={`Filter by tag: ${tag}`}
            aria-label={`Filter by tag: ${tag}`}
          >
            <span className="mr-1 max-w-[200px] truncate" title={tag}>{tag}</span>
            <button type="button" className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-md text-accent hover:bg-accent/20 transition-colors" aria-label={`Remove tag ${tag}`} onClick={(e) => { e.stopPropagation(); removeTag(tag); }}>
              <Icon name="x" className="h-4 w-4" />
            </button>
          </Badge>
        ))}
      </div>
      {isAdding && !isValid && newTag.trim() && (
        <div className="mt-1 text-xs text-destructive">
          {(() => {
            if (tags.length >= maxTags) return `Maximum ${maxTags} tags allowed`;
            if (tags.includes(newTag.trim())) return "This tag already exists";
            return "Tag too long (max 50 characters)";
          })()}
        </div>
      )}
      <LoginRequiredModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} message="You must be logged in to manage this document's tags." />
    </div>
  );
}


