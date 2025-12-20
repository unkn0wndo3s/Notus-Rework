"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import FilterModal from "@/components/ui/filter-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Icon from "@/components/Icon";
import { useSearch, type NoteFilters } from "@/contexts/SearchContext";
import { useTagsContext } from "@/contexts/TagsContext";

interface NotesFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FolderOption {
  id: number;
  name: string;
}

const sharedOptions: Array<{ value: NoteFilters["shared"] | undefined; label: string }> = [
  { value: undefined, label: "All notes" },
  { value: "shared", label: "Shared notes" },
  { value: "private", label: "Private notes" },
];

const normalizeFilters = (filters: NoteFilters): NoteFilters => ({
  ...filters,
  tags: Array.from(new Set((filters.tags || []).map((tag) => tag.trim()).filter(Boolean))),
});

export default function NotesFilterModal({ isOpen, onClose }: NotesFilterModalProps) {
  const { data: session } = useSession();
  const {
    filters,
    applyFilters,
    resetFilters,
    hasActiveFilters,
    defaultFilters,
  } = useSearch();
  const [localFilters, setLocalFilters] = useState<NoteFilters>(normalizeFilters(filters));
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [hasLoadedFolders, setHasLoadedFolders] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const isAuthenticated = Boolean(session?.user?.id);
  
  // Try to use TagsContext first, otherwise fetch via API
  const tagsContext = useTagsContext();
  const contextTags = tagsContext.getAllTags();

  useEffect(() => {
    if (isOpen) {
      setLocalFilters(normalizeFilters(filters));
      if (isAuthenticated && !hasLoadedFolders && !isLoadingFolders) {
        void fetchFolders();
      }
      // If we have tags from context, use them, otherwise fetch via API
      if (contextTags.length > 0) {
        setAvailableTags(contextTags);
      } else if (isAuthenticated && availableTags.length === 0 && !isLoadingTags) {
        void fetchTags();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, filters, isAuthenticated, contextTags]);

  const fetchFolders = async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoadingFolders(true);
      setFoldersError(null);
      const response = await fetch("/api/folders", { credentials: "include" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setFoldersError(data.error || "Failed to load folders.");
        setFolders([]);
        return;
      }
      const data = await response.json();
      setFolders(Array.isArray(data.folders) ? data.folders : []);
      setHasLoadedFolders(true);
    } catch (error) {
      setFoldersError("Failed to load folders.");
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const fetchTags = async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoadingTags(true);
      setTagsError(null);
      const response = await fetch("/api/tags", { credentials: "include" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setTagsError(data.error || "Failed to load tags.");
        setAvailableTags([]);
        return;
      }
      const data = await response.json();
      setAvailableTags(Array.isArray(data.tags) ? data.tags : []);
    } catch (error) {
      setTagsError("Failed to load tags.");
      setAvailableTags([]);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const updateFilter = <K extends keyof NoteFilters>(key: K, value: NoteFilters[K]) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleToggleTag = (tag: string) => {
    setLocalFilters((prev) => {
      const currentTags = prev.tags || [];
      return { ...prev, tags: currentTags.filter((t) => t !== tag) };
    });
  };

  const handleSelectTag = (tag: string) => {
    if (!tag || (localFilters.tags || []).includes(tag)) return;
    setLocalFilters((prev) => {
      return { ...prev, tags: [...(prev.tags || []), tag] };
    });
  };

  const availableTagsForSelect = useMemo(() => {
    const selectedTags = new Set(localFilters.tags || []);
    return availableTags.filter((tag) => !selectedTags.has(tag));
  }, [availableTags, localFilters.tags]);

  const handleApply = () => {
    applyFilters(normalizeFilters(localFilters));
    onClose();
  };

  const hasChanges = useMemo(() => {
    const normalizedLocal = JSON.stringify(normalizeFilters(localFilters));
    const normalizedGlobal = JSON.stringify(normalizeFilters(filters));
    return normalizedLocal !== normalizedGlobal;
  }, [localFilters, filters]);

  return (
    <FilterModal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter my notes"
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Updated date</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-date-from" className="text-sm text-[var(--muted-foreground)]">From</label>
              <Input
                id="filter-date-from"
                type="date"
                value={localFilters.dateFrom ?? ""}
                onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-date-to" className="text-sm text-[var(--muted-foreground)]">To</label>
              <Input
                id="filter-date-to"
                type="date"
                value={localFilters.dateTo ?? ""}
                onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Author</h3>
          <Input
            placeholder="First name, last name or username"
            value={localFilters.author ?? ""}
            onChange={(e) => updateFilter("author", e.target.value || undefined)}
          />
        </section>

        <section className="space-y-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Sharing</h3>
              <select
                className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                value={localFilters.shared ?? ""}
                onChange={(e) => updateFilter("shared", e.target.value ? (e.target.value as NoteFilters["shared"]) : undefined)}
                disabled={!isAuthenticated}
              >
                {sharedOptions.map((option) => (
                  <option key={option.label} value={option.value ?? ""}>
                    {option.label}{!isAuthenticated && option.value ? " (login required)" : ""}
                  </option>
                ))}
              </select>
              {!isAuthenticated && (
                <p className="text-xs text-[var(--muted-foreground)]">Log in to filter by sharing status.</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Folder</h3>
              <select
                className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                value={localFilters.folderId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  updateFilter("folderId", value ? Number(value) : undefined);
                }}
                disabled={!isAuthenticated || isLoadingFolders}
              >
                <option value="">All folders</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              {foldersError && (
                <p className="text-xs text-[var(--destructive)]">{foldersError}</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Tags</h3>
          {isAuthenticated && (
            <>
              {(localFilters.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-md">
                  {(localFilters.tags || []).map((tag) => (
                    <Badge
                      key={tag}
                      variant="purple"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className="rounded-full p-0.5 hover:bg-[var(--primary)]/20 transition-colors ml-0.5"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <Icon name="x" className="h-3 w-3 text-[var(--primary)]" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {isLoadingTags ? (
                <div className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                  <Icon name="spinner" className="w-5 h-5 animate-spin inline-block mr-2 text-[var(--primary)]" />
                  Loading tags...
                </div>
              ) : tagsError ? (
                <div className="p-3 bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 rounded-md">
                  <p className="text-xs text-[var(--destructive)]">{tagsError}</p>
                </div>
              ) : availableTagsForSelect.length === 0 ? (
                <div className="p-3 border border-[var(--border)] rounded-md bg-[var(--muted)]/30">
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {availableTags.length === 0
                      ? "No tag available."
                      : "All tags selected."}
                  </p>
                </div>
              ) : (
                <select
                  className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  value=""
                  onChange={(e) => {
                    const selectedTag = e.target.value;
                    if (selectedTag) {
                      handleSelectTag(selectedTag);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">Select a tag...</option>
                  {availableTagsForSelect.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          {!isAuthenticated && (
            <div className="p-3 bg-[var(--muted)]/30 border border-[var(--border)] rounded-md">
              <p className="text-xs text-[var(--muted-foreground)]">Log in to filter by tags.</p>
            </div>
          )}
        </section>

        <footer className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 md:flex-row md:items-center md:justify-between flex-shrink-0">
          <div className="text-sm text-[var(--muted-foreground)]">
            {hasActiveFilters ? "Filters applied." : "No filter applied."}
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Button
              type="button"
              variant="ghostPurple"
              className="cursor-pointer py-2 px-4"
              onClick={() => {
                resetFilters();
                setLocalFilters(normalizeFilters(defaultFilters));
              }}
            >
              Reset
            </Button>
            <Button 
              type="button" 
              variant="primary" 
              className="cursor-pointer py-2 px-4"
              onClick={handleApply} 
              disabled={!hasChanges && !hasActiveFilters}
            >
              Apply filters
            </Button>
          </div>
        </footer>
      </div>
    </FilterModal>
  );
}


