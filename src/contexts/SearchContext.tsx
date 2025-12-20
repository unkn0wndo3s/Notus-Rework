"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { AnyDocument } from "@/lib/types";

export type SharedFilter = "shared" | "private";

export interface NoteFilters {
  dateFrom?: string;
  dateTo?: string;
  author?: string;
  shared?: SharedFilter;
  folderId?: number;
  tags: string[];
}

interface FilterOptions {
  currentUserId?: string | number | null;
}

interface SearchContextType {
  searchQuery: string;
  isSearching: boolean;
  hasActiveFilters: boolean;
  filters: NoteFilters;
  defaultFilters: NoteFilters;
  startSearch: (query: string) => void;
  clearSearch: () => void;
  applyFilters: (filters: NoteFilters) => void;
  resetFilters: () => void;
  filterByTag: (tag: string) => void;
  filterDocuments: (documents: AnyDocument[], options?: FilterOptions) => AnyDocument[];
  filterLocalDocuments: (documents: AnyDocument[], options?: FilterOptions) => AnyDocument[];
}

interface SearchProviderProps {
  children: ReactNode;
}

const createDefaultFilters = (): NoteFilters => ({ tags: [] });

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: SearchProviderProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [filters, setFilters] = useState<NoteFilters>(createDefaultFilters);

  const normalizedFilters = useMemo(() => {
    const uniqTags = Array.from(new Set((filters.tags || []).map((tag) => tag.trim()).filter(Boolean)));
    return {
      ...filters,
      tags: uniqTags,
    };
  }, [filters]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      normalizedFilters.author?.trim() ||
      normalizedFilters.dateFrom ||
      normalizedFilters.dateTo ||
      normalizedFilters.shared ||
      normalizedFilters.folderId ||
      (normalizedFilters.tags?.length ?? 0) > 0
    );
  }, [normalizedFilters]);

  const startSearch = (query: string) => {
    setSearchQuery(query);
    setIsSearching(query.length > 0);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
  };

  const normalizeFiltersPayload = (nextFilters: NoteFilters): NoteFilters => {
    return {
      ...createDefaultFilters(),
      ...nextFilters,
      author: nextFilters.author?.trim() || undefined,
      dateFrom: nextFilters.dateFrom || undefined,
      dateTo: nextFilters.dateTo || undefined,
      shared: nextFilters.shared,
      folderId: typeof nextFilters.folderId === "number" && !Number.isNaN(nextFilters.folderId)
        ? nextFilters.folderId
        : undefined,
      tags: Array.from(new Set((nextFilters.tags || []).map((tag) => tag.trim()).filter(Boolean))),
    };
  };

  const applyFilters = (nextFilters: NoteFilters) => {
    setFilters(normalizeFiltersPayload(nextFilters));
  };

  const resetFilters = () => {
    setFilters(createDefaultFilters());
  };

  const filterByTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setFilters({
      ...createDefaultFilters(),
      tags: [trimmed],
    });
    clearSearch();
  };

  const matchesSearchQuery = (doc: AnyDocument): boolean => {
    if (!isSearching || !searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = doc.title?.toLowerCase().includes(query);
    const tagsArray = Array.isArray((doc as any).tags) ? ((doc as any).tags as string[]) : [];
    const tagsMatch = tagsArray.some((t) => t?.toLowerCase().includes(query));
    return Boolean(titleMatch || tagsMatch);
  };

  const matchesActiveFilters = (doc: AnyDocument, options?: FilterOptions): boolean => {
    if (!hasActiveFilters) return true;

    const docAny = doc as any;
    const docDateRaw = docAny.updated_at || docAny.created_at;
    const docDate = docDateRaw ? new Date(docDateRaw) : null;

    if (normalizedFilters.dateFrom) {
      const fromDate = new Date(normalizedFilters.dateFrom);
      if (!docDate || docDate < fromDate) return false;
    }

    if (normalizedFilters.dateTo) {
      const toDate = new Date(normalizedFilters.dateTo);
      if (!docDate || docDate > toDate) return false;
    }

    if (normalizedFilters.author) {
      const authorQuery = normalizedFilters.author.toLowerCase();
      const authorFields = [
        docAny.first_name,
        docAny.last_name,
        docAny.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!authorFields || !authorFields.includes(authorQuery)) {
        return false;
      }
    }

    if (normalizedFilters.tags.length > 0) {
      const docTags = Array.isArray(docAny.tags) ? (docAny.tags as string[]) : [];
      const lowerDocTags = docTags.map((t) => t?.toLowerCase()).filter(Boolean);
      const allTagsPresent = normalizedFilters.tags.every((tag) =>
        lowerDocTags.includes(tag.toLowerCase())
      );
      if (!allTagsPresent) return false;
    }

    if (normalizedFilters.folderId) {
      // Logic supports folderIds
      const folderIds = Array.isArray(docAny.folderIds) ? docAny.folderIds : [];
      const hasFolder = folderIds.some(
        (id: number | string) => Number(id) === Number(normalizedFilters.folderId)
      );
      if (!hasFolder) return false;
    }

    if (normalizedFilters.shared) {
      const currentUserId = options?.currentUserId ? String(options.currentUserId) : undefined;
      const ownerId = docAny.user_id ? String(docAny.user_id) : undefined;
      const ownedByCurrent = currentUserId && ownerId ? currentUserId === ownerId : false;
      const sharedList = Array.isArray(docAny.sharedWith) ? docAny.sharedWith : [];
      const hasOutgoingShares = sharedList.length > 0;
      const isForeignDoc = currentUserId && ownerId ? ownerId !== currentUserId : false;
      const isSharedDoc = hasOutgoingShares || isForeignDoc || Boolean(docAny.shared);

      if (normalizedFilters.shared === "shared" && !isSharedDoc) {
        return false;
      }
      if (normalizedFilters.shared === "private" && (!ownedByCurrent || hasOutgoingShares)) {
        return false;
      }
    }

    return true;
  };

  const applySearchAndFilters = (documents: AnyDocument[], options?: FilterOptions): AnyDocument[] => {
    if (!Array.isArray(documents) || documents.length === 0) return documents;
    return documents.filter((doc) => matchesSearchQuery(doc) && matchesActiveFilters(doc, options));
  };

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        isSearching,
        hasActiveFilters,
        filters: normalizedFilters,
        defaultFilters: createDefaultFilters(),
        startSearch,
        clearSearch,
        applyFilters,
        resetFilters,
        filterByTag,
        filterDocuments: applySearchAndFilters,
        filterLocalDocuments: applySearchAndFilters,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextType {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}
