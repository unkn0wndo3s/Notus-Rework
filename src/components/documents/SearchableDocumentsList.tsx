"use client";

import { useState, useEffect, useActionState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useSearch } from "@/contexts/SearchContext";
import { useSelection } from "@/contexts/SelectionContext";
import { deleteMultipleDocumentsAction } from "@/actions/documentActions";
import { addDocumentsToFolder as addDocumentsToFolderAction } from "@/actions/folderActions";
import DocumentCard from "@/components/documents/DocumentCard";
import SelectionBar from "@/components/documents/SelectionBar";
import ConnectionWarning from "@/components/common/ConnectionWarning";
import { Card, Alert, DocumentsGrid } from "@/components/ui";
import { Document, LocalDocument, AnyDocument } from "@/lib/types";
import { TagsProvider } from "@/contexts/TagsContext";
import Icon from "@/components/Icon";

const LOCAL_DOCS_KEY = "notus.local.documents";

interface SearchableDocumentsListProps {
  documents?: AnyDocument[];
  currentUserId?: string;
  error?: string;
  isFavoritesList?: boolean;
  onRemoveFromFolder?: (documentIds: string[]) => void;
}

export function SearchableDocumentsList({
  documents: serverDocuments = [],
  currentUserId,
  error,
  isFavoritesList = false,
  onRemoveFromFolder,
}: SearchableDocumentsListProps) {
  const { filterDocuments, filterLocalDocuments, isSearching, hasActiveFilters } = useSearch();
  const router = useRouter();
  const [localDocuments, setLocalDocuments] = useState<LocalDocument[]>([]);
  const [runtimeDocuments, setRuntimeDocuments] = useState<AnyDocument[]>(serverDocuments);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, formAction, isPending] = useActionState(
    deleteMultipleDocumentsAction,
    undefined
  );
  const [selectMode, setSelectMode] = useState(false);
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const { setIsSelectModeActive } = useSelection();

  useEffect(() => { setIsSelectModeActive(selectMode); }, [selectMode, setIsSelectModeActive]);

  useEffect(() => {
    const loadLocalDocs = () => {
      try {
        const raw = localStorage.getItem(LOCAL_DOCS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setLocalDocuments(parsed); else setLocalDocuments([]);
      } catch (_) { setLocalDocuments([]); }
    };
    loadLocalDocs();
    const onStorage = (e: StorageEvent) => { if (e.key === LOCAL_DOCS_KEY) { loadLocalDocs(); } };
    if (typeof globalThis.window !== "undefined") {
      globalThis.window.addEventListener("storage", onStorage);
    }
    return () => {
      if (typeof globalThis.window !== "undefined") {
        globalThis.window.removeEventListener("storage", onStorage);
      }
    };
  }, []);

  useEffect(() => { setRuntimeDocuments(serverDocuments); }, [serverDocuments]);

  useEffect(() => {
    setIsMessageVisible(!!message);
    if (message && !isPending && !message.includes("Error")) {
      const timer = setTimeout(() => { router.refresh(); }, 1000);
      return () => clearTimeout(timer);
    }
  }, [message, isPending, router]);

  const baseServerDocs: AnyDocument[] = isFavoritesList ? runtimeDocuments : serverDocuments;
  const documents: AnyDocument[] = currentUserId 
    ? [...baseServerDocs].sort((a, b) => new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime()).reverse()
    : ([...localDocuments, ...baseServerDocs] as AnyDocument[]).sort((a, b) => new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime()).reverse();

  const toggleSelect = (id: string | number, checked: boolean) => {
    const idStr = String(id);
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(idStr); else set.delete(idStr);
      return Array.from(set);
    });
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredDocuments.length) setSelectedIds([]);
    else setSelectedIds(filteredDocuments.map((d) => String(d.id)));
  };

  const handleBulkDelete = (formData: FormData) => {
    if (selectedIds.length === 0) return;
    const localIdsToDelete: string[] = [];
    const serverIdsToDelete: string[] = [];
    selectedIds.forEach((id) => {
      const doc = documents.find((d) => String(d.id) === id);
      if (doc && !('user_id' in doc) || (doc as LocalDocument).user_id === undefined) localIdsToDelete.push(id);
      else serverIdsToDelete.push(id);
    });
    if (localIdsToDelete.length > 0) {
      try {
        const raw = localStorage.getItem(LOCAL_DOCS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const updated = parsed.filter((doc: LocalDocument) => !localIdsToDelete.includes(doc.id));
        localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(updated));
        setLocalDocuments(updated);
      } catch (e) { console.error("Error deleting local documents:", e); }
    }
    if (currentUserId && serverIdsToDelete.length > 0) {
      formData.append("userId", String(currentUserId));
      serverIdsToDelete.forEach((id) => formData.append("documentIds", String(id)));
      startTransition(() => { formAction(formData); });
    }
    setSelectedIds([]);
    setSelectMode(false);
  };

  if (error) {
    return (
      <Alert variant="error">
        <Alert.Description>
          Error loading documents: {error}
        </Alert.Description>
      </Alert>
    );
  }

  const hasSearchOrFilters = isSearching || hasActiveFilters;

  const filteredDocuments: AnyDocument[] = hasSearchOrFilters
    ? ([...filterLocalDocuments(localDocuments as unknown as AnyDocument[], { currentUserId }), ...filterDocuments(baseServerDocs as unknown as AnyDocument[], { currentUserId })] as AnyDocument[])
    : documents;

  if (documents.length === 0) {
    return (
      <Card className="text-center py-12">
        <Card.Content>
          <div className="text-muted-foreground mb-4"><Icon name="document" className="w-16 h-16 mx-auto" /></div>
          <Card.Title className="text-lg mb-2">No documents yet</Card.Title>
          <Card.Description>Create your first document!</Card.Description>
        </Card.Content>
      </Card>
    );
  }

  if (hasSearchOrFilters && filteredDocuments.length === 0) {
    return (
      <Card className="text-center py-12">
        <Card.Content>
          <div className="text-muted-foreground mb-4"><Icon name="search" className="w-16 h-16 mx-auto" /></div>
          <Card.Title className="text-lg mb-2">No results found</Card.Title>
          <Card.Description>Try adjusting your search or filters.</Card.Description>
        </Card.Content>
      </Card>
    );
  }

  return (
    <TagsProvider documents={[...localDocuments as unknown as AnyDocument[], ...baseServerDocs as unknown as AnyDocument[]]}>
      <section className="space-y-3">
        {message && isMessageVisible && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start justify-between gap-3">
            <p className="text-sm text-destructive flex-1">{message}</p>
            <button type="button" onClick={() => setIsMessageVisible(false)} aria-label="Close message" className="text-destructive hover:opacity-80 shrink-0">
              <Icon name="x" className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}
        <DocumentsGrid>
          {filteredDocuments.map((document, index) => {
            const isLocal = !('user_id' in document) || (document as LocalDocument).user_id === undefined;
            // Compose a stable, unique key using source and index as a tiebreaker so
            // documents with identical numeric ids (possibly differing types) do not collide.
            const listKey = `${isLocal ? 'local' : 'server'}-${String(document.id)}-${index}`;
            return (
              <li key={listKey} className="w-full list-none">
                <DocumentCard
                  document={document as any}
                  currentUserId={currentUserId}
                  isLocal={isLocal}
                  selectMode={selectMode}
                  selected={selectedIds.includes(String(document.id))}
                  onToggleSelect={toggleSelect}
                  onEnterSelectMode={(firstId: string | number) => {
                    if (!selectMode) { setSelectMode(true); setSelectedIds([String(firstId)]); }
                  }}
                  onFavoriteChange={(docId, fav) => {
                    if (isFavoritesList && !fav) {
                      setRuntimeDocuments((prev) => prev.filter((d) => String(d.id) !== String(docId)));
                      setSelectedIds((prev) => prev.filter((id) => id !== String(docId)));
                    }
                  }}
                />
              </li>
            );
          })}
        </DocumentsGrid>
      </section>
      {selectMode && (
        <SelectionBar
          selectedCount={selectedIds.length}
          totalCount={filteredDocuments.length}
          isPending={isPending}
          onCancel={() => { setSelectMode(false); setSelectedIds([]); }}
          onToggleAll={toggleAll}
          onBulkDelete={handleBulkDelete}
          onAddToFolder={currentUserId && !onRemoveFromFolder ? async (folderId: number, documentIds: string[]) => {
            try {
              const docIds = documentIds.map(id => Number(id)).filter(id => !Number.isNaN(id));
              const result = await addDocumentsToFolderAction(folderId, docIds);
              if (result.success) {
                setSelectMode(false);
                setSelectedIds([]);
                router.refresh();
              } else {
                console.error("Error:", result.error);
              }
            } catch (error) {
              console.error("Error adding to folder:", error);
            }
          } : undefined}
          onRemoveFromFolder={onRemoveFromFolder ? async (documentIds: string[]) => {
            try {
              await onRemoveFromFolder(documentIds);
              setSelectMode(false);
              setSelectedIds([]);
            } catch (error) {
              console.error("Error removing from folder:", error);
            }
          } : undefined}
          selectedDocumentIds={selectedIds}
          currentUserId={currentUserId}
        />
      )}
      <ConnectionWarning currentUserId={currentUserId} hasSelectionBar={selectMode} />
    </TagsProvider>
  );
}
