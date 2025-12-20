"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Icon from "@/components/Icon";

interface SelectionBarProps {
  selectedCount: number;
  totalCount: number;
  isPending: boolean;
  onCancel: () => void;
  onToggleAll: () => void;
  onBulkDelete: (formData: FormData) => void;
  onAddToFolder?: (folderId: number, documentIds: string[]) => void | Promise<void>;
  onRemoveFromFolder?: (documentIds: string[]) => void | Promise<void>;
  selectedDocumentIds: string[];
  currentUserId?: string | number | null;
}

import { getFolders } from "@/actions/folderActions";

export default function SelectionBar({
  selectedCount,
  totalCount,
  isPending,
  onCancel,
  onToggleAll,
  onBulkDelete,
  onAddToFolder,
  onRemoveFromFolder,
  selectedDocumentIds,
  currentUserId,
}: SelectionBarProps) {
  const isAllSelected = selectedCount === totalCount;
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [folders, setFolders] = useState<Array<{ id: number; name: string }>>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToFolderClick = async () => {
    if (!onAddToFolder) return;
    setIsLoadingFolders(true);
    try {
      const result = await getFolders();
      if (result.success) {
        setFolders(result.folders || []);
        setShowFolderModal(true);
      }
    } catch (error) {
      console.error("Error loading folders:", error);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleConfirmAddToFolder = async () => {
    if (!selectedFolderId || !onAddToFolder || selectedDocumentIds.length === 0) return;
    setIsAdding(true);
    try {
      const folderId = Number.parseInt(selectedFolderId);
      await onAddToFolder(folderId, selectedDocumentIds);
      setShowFolderModal(false);
      setSelectedFolderId("");
    } catch (error) {
      console.error("Error adding to folder:", error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <aside className="fixed left-0 right-0 z-20 px-0 md:ml-68 md:px-4 bottom-0 mb-0" role="region" aria-label="Selection bar">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-3 bg-background text-foreground border-t border-border">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button onClick={onCancel} variant="ghost" size="icon" aria-label="Cancel selection">
                <Icon name="x" className="w-6 h-6" />
              </Button>
              <span className="text-sm text-foreground font-medium hidden md:inline">
                {selectedCount} note{selectedCount > 1 ? 's' : ''}
              </span>
              <span className="text-sm text-foreground font-medium md:hidden">{selectedCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onToggleAll} variant="ghost" size="sm" className="flex items-center gap-2 p-3 py-1.5 rounded-full font-title text-lg" aria-label={isAllSelected ? "Deselect all" : "Select all"}>
                {isAllSelected ? "Deselect all" : "Select all"}
              </Button>
              {onRemoveFromFolder ? (
                <Button 
                  onClick={async () => {
                    if (selectedDocumentIds.length > 0) {
                      await onRemoveFromFolder(selectedDocumentIds);
                    }
                  }}
                  disabled={isPending || selectedCount === 0} 
                  variant="default" 
                  className="flex items-center gap-2 p-3 lg:py-1.5 rounded-full font-medium" 
                  aria-label="Remove from folder"
                >
                  <Icon name="folder" className="w-5 h-5" />
                  <span className="hidden lg:inline">{isPending ? "Removing..." : "Remove from folder"}</span>
                </Button>
              ) : onAddToFolder && currentUserId ? (
                <Button 
                  onClick={handleAddToFolderClick} 
                  disabled={isLoadingFolders || selectedCount === 0} 
                  variant="default" 
                  className="flex items-center gap-2 p-3 lg:py-1.5 rounded-full font-medium" 
                  aria-label="Add to folder"
                >
                  <Icon name="folder" className="w-5 h-5" />
                  <span className="hidden lg:inline">{isLoadingFolders ? "Loading..." : "Add to folder"}</span>
                </Button>
              ) : null}
              <form action={onBulkDelete} className="flex items-center">
                <Button type="submit" disabled={isPending || selectedCount === 0} variant="destructive" className="flex items-center gap-2 p-3 lg:py-1.5 rounded-full font-medium" aria-label="Delete selected notes">
                  <Icon name="trash" className="w-5 h-5" />
                  <span className="hidden lg:inline">{isPending ? "Deleting..." : "Delete"}</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </aside>
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowFolderModal(false)}>
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Select a folder</h3>
            {folders.length === 0 ? (
              <p className="text-muted-foreground mb-4">No folder available. Create one first.</p>
            ) : (
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full p-2 border border-border rounded-md mb-4 bg-background"
              >
                <option value="">Select a folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={String(folder.id)}>
                    {folder.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowFolderModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmAddToFolder} 
                disabled={!selectedFolderId || isAdding}
                variant="default"
              >
                {isAdding ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
