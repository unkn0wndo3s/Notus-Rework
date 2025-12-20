"use client";

import { useState, useEffect } from "react";
import { useActionState, startTransition } from "react";
import { deleteMultipleDocumentsAction } from "@/lib/actions";
import DocumentCard from "@/components/documents/DocumentCard";
import SelectionBar from "@/components/documents/SelectionBar";
import ConnectionWarning from "@/components/common/ConnectionWarning";
import { useSelection } from "@/contexts/SelectionContext";
import Icon from "@/components/Icon";
import { Document, LocalDocument, AnyDocument } from "@/lib/types";

const LOCAL_DOCS_KEY = "notus.local.documents";

interface DocumentsGridClientProps {
  documents?: Document[];
  currentUserId?: string | number | null;
}

export default function DocumentsGridClient({ documents: serverDocuments = [], currentUserId }: DocumentsGridClientProps) {
  const [localDocuments, setLocalDocuments] = useState<LocalDocument[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, formAction, isPending] = useActionState(
    deleteMultipleDocumentsAction,
    undefined
  );
  const [selectMode, setSelectMode] = useState(false);
  const { setIsSelectModeActive } = useSelection();

  useEffect(() => { setIsSelectModeActive(selectMode); }, [selectMode, setIsSelectModeActive]);

  useEffect(() => {
    const loadLocalDocs = () => {
      try {
        const raw = localStorage.getItem(LOCAL_DOCS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) { setLocalDocuments(parsed); } else { setLocalDocuments([]); }
      } catch (_) { setLocalDocuments([]); }
    };
    loadLocalDocs();
    const onStorage = (e: StorageEvent) => { if (e.key === LOCAL_DOCS_KEY) { loadLocalDocs(); } };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const documents = currentUserId 
    ? (serverDocuments as unknown as AnyDocument[])
    : ([...localDocuments, ...serverDocuments] as unknown as AnyDocument[]);

  const toggleSelect = (id: string | number, checked: boolean) => {
    const idStr = String(id);
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(idStr);
      else set.delete(idStr);
      return Array.from(set);
    });
  };

  const toggleAll = () => {
    if (selectedIds.length === documents.length) setSelectedIds([]);
    else setSelectedIds(documents.map((d) => String(d.id)));
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
      } catch (_) {}
    }
    if (currentUserId && serverIdsToDelete.length > 0) {
      formData.append("userId", String(currentUserId));
      serverIdsToDelete.forEach((id) => formData.append("documentIds", String(id)));
      startTransition(() => { formAction(formData); });
    }
    setSelectedIds([]);
    setSelectMode(false);
  };

  return (
    <div className="space-y-2">
      <ul className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        {documents.map((document) => {
          const isLocal = !('user_id' in document) || (document as LocalDocument).user_id === undefined;
          return (
            <li key={String(document.id)} className="w-full list-none">
              <DocumentCard
                document={document as any}
                currentUserId={currentUserId as any}
                isLocal={isLocal}
                selectMode={selectMode}
                selected={selectedIds.includes(String(document.id))}
                onToggleSelect={toggleSelect}
                onEnterSelectMode={(firstId: string | number) => {
                  if (!selectMode) { setSelectMode(true); setSelectedIds([String(firstId)]); }
                }}
              />
            </li>
          );
        })}
      </ul>
      {selectMode && (
        <SelectionBar
          selectedCount={selectedIds.length}
          totalCount={documents.length}
          isPending={isPending}
          onCancel={() => { setSelectMode(false); setSelectedIds([]); }}
          onToggleAll={toggleAll}
          onBulkDelete={handleBulkDelete}
          onAddToFolder={currentUserId ? async (folderId: number, documentIds: string[]) => {
            try {
              const response = await fetch(`/api/folders/${folderId}/documents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentIds }),
              });
              if (response.ok) {
                setSelectMode(false);
                setSelectedIds([]);
              } else {
                const data = await response.json();
                console.error("Error:", data.error);
              }
            } catch (error) {
              console.error("Error adding to folder:", error);
            }
          } : undefined}
          selectedDocumentIds={selectedIds}
          currentUserId={String(currentUserId || "")}
        />
      )}
      <ConnectionWarning currentUserId={String(currentUserId || "")} hasSelectionBar={selectMode} />
    </div>
  );
}


