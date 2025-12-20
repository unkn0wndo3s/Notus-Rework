"use client";

import { useState, useEffect, useActionState, startTransition, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import NavBar from "@/components/navigation/NavBar";
import ContentWrapper from "@/components/common/ContentWrapper";
import { Button } from "@/components/ui/button";
import { Card, Alert, BackHeader, Modal, Input } from "@/components/ui";
import Icon from "@/components/Icon";
import { useSession } from "next-auth/react";
import { SearchableDocumentsList } from "@/components/documents/SearchableDocumentsList";
import Link from "next/link";
import { createDocumentAction } from "@/actions/documentActions";
import { getFolderById, addDocumentsToFolder, removeDocumentsFromFolder } from "@/actions/folderActions";

interface Document {
  id: number;
  title: string;
  content: string;
  tags: string[];
  is_favorite: boolean | null;
  created_at: string;
  updated_at: string;
}

interface FolderData {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  documents: Document[];
}

interface CreateDocumentActionResult {
  success?: boolean;
  documentId?: number;
  message?: string;
  error?: string;
}

export default function FolderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const [folder, setFolder] = useState<FolderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [isAddingToFolder, setIsAddingToFolder] = useState(false);

  const folderId = params?.id ? Number.parseInt(String(params.id)) : null;

  const [createNoteState, createNoteAction, isCreatingNote] = useActionState(
    createDocumentAction as unknown as (
      prev: CreateDocumentActionResult | null,
      fd: FormData
    ) => Promise<CreateDocumentActionResult>,
    null
  );

  const loadFolder = useCallback(async () => {
    if (!folderId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getFolderById(folderId);
      if (result.success) {
        setFolder(result.folder as unknown as FolderData);
      } else {
        setError(result.error || "Error loading folder");
      }
    } catch (err: any) {
      console.error("Error loading folder:", err);
      setError("Error loading folder");
    } finally {
      setIsLoading(false);
    }
  }, [folderId]);

  const addNoteToFolder = useCallback(async (documentId: number, folderId: number) => {
    setIsAddingToFolder(true);
    try {
      const result = await addDocumentsToFolder(folderId, [documentId]);
      if (result.success) {
        setShowCreateNoteModal(false);
        setNoteTitle("");
        loadFolder();
        router.push(`/documents/${documentId}`);
      } else {
        alert(result.error || "Error adding note to folder");
      }
    } catch (err: any) {
      console.error("Error adding note to folder:", err);
      alert("Error adding note to folder");
    } finally {
      setIsAddingToFolder(false);
    }
  }, [loadFolder, router]);

  useEffect(() => {
    if (session?.user?.id && folderId) {
      loadFolder();
    }
  }, [session, folderId, loadFolder]);

  useEffect(() => {
    if (createNoteState && createNoteState.documentId) {
      const documentId = createNoteState.documentId;
      if (documentId && folderId) {
        addNoteToFolder(documentId, folderId);
      }
    }
  }, [createNoteState, folderId, addNoteToFolder]);

  const handleCreateNote = () => {
    if (!session?.user?.id || !folderId) return;
    if (!noteTitle.trim()) {
      alert("Please enter a title for the note");
      return;
    }

    const formData = new FormData();
    formData.set("title", noteTitle.trim());
    formData.set("content", "");
    formData.set("userId", String(session.user.id));

    startTransition(() => {
      createNoteAction(formData);
    });
  };

  const handleRemoveDocuments = async (documentIds: string[]) => {
    if (!folderId) return;
    const ids = documentIds.map((id) => Number.parseInt(id)).filter((id) => !Number.isNaN(id));
    setRemovingIds(new Set(ids));
    try {
      const result = await removeDocumentsFromFolder(folderId, ids);
      if (result.success) {
        loadFolder();
      } else {
        alert(result.error || "Error removing documents");
      }
    } catch (err: any) {
      console.error("Error removing documents:", err);
      alert("Error removing documents");
    } finally {
      setRemovingIds(new Set());
    }
  };

  if (!session?.user) {
    return (
      <main className="min-h-screen bg-background">
        <NavBar />
        <ContentWrapper maxWidth="lg">
          <p>You must be logged in to access folders.</p>
        </ContentWrapper>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <NavBar />
        <ContentWrapper maxWidth="lg">
          <div className="text-center py-12">
            <Icon name="spinner" className="w-8 h-8 mx-auto animate-spin" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </ContentWrapper>
      </main>
    );
  }

  if (error || !folder) {
    return (
      <main className="min-h-screen bg-background">
        <NavBar />
        <ContentWrapper maxWidth="lg">
          <Alert variant="error">
            <Alert.Description>{error || "Folder not found"}</Alert.Description>
          </Alert>
          <div className="mt-4">
            <Link href="/folders">
              <Button variant="ghost">Back to folders</Button>
            </Link>
          </div>
        </ContentWrapper>
      </main>
    );
  }

  const documents = folder.documents.map((doc) => ({
    ...doc,
    id: String(doc.id),
    user_id: session.user?.id ? String(session.user.id) : undefined,
    folderIds: [folder.id],
    is_favorite: doc.is_favorite ?? null,
  }));

  return (
    <main className="min-h-screen bg-background">
      <NavBar />
      <ContentWrapper maxWidth="lg">
        <section className="space-y-6">
          <div className="hidden md:flex md:items-center md:justify-between mb-4">
            <BackHeader href="/folders" title={folder.name} />
            <Button
              onClick={() => setShowCreateNoteModal(true)}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Icon name="note" className="w-5 h-5" />
              <span>Create note</span>
            </Button>
          </div>
          <header className="md:hidden flex items-center gap-3 mb-4">
            <Link href="/folders" className="text-foreground font-semibold flex items-center" aria-label="Back">
              <Icon name="arrowLeft" className="h-6 w-6 mr-2" />
            </Link>
            <div className="flex-1">
              <h1 className="font-title text-2xl font-regular text-foreground">
                {folder.name}
              </h1>
            </div>
            <Button
              onClick={() => setShowCreateNoteModal(true)}
              variant="primary"
              size="sm"
              className="flex items-center gap-2"
            >
              <Icon name="note" className="w-4 h-4" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </header>
          <p className="text-sm text-muted-foreground -mt-2 md:mt-0">
            {folder.documents.length} note{folder.documents.length > 1 ? "s" : ""} in this folder
          </p>

          {folder.documents.length === 0 ? (
            <Card className="text-center py-12">
              <Card.Content>
                <div className="text-muted-foreground mb-4">
                  <Icon name="document" className="w-16 h-16 mx-auto" />
                </div>
                <Card.Title className="text-lg mb-2">No documents</Card.Title>
                <Card.Description className="mb-4">
                  This folder is empty. Create your first note.
                </Card.Description>
                <Button
                  onClick={() => setShowCreateNoteModal(true)}
                  variant="primary"
                  className="flex items-center gap-2 mx-auto"
                >
                  <Icon name="note" className="w-5 h-5" />
                  <span>Create note</span>
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <SearchableDocumentsList
              documents={documents}
              currentUserId={session.user.id ? String(session.user.id) : undefined}
              onRemoveFromFolder={handleRemoveDocuments}
            />
          )}
        </section>
      </ContentWrapper>

      <Modal
        isOpen={showCreateNoteModal}
        onClose={() => {
          setShowCreateNoteModal(false);
          setNoteTitle("");
        }}
        title="Create a note"
        size="md"
      >
        <Modal.Content>
          <div className="space-y-4">
            <Input
              label="Note title"
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Ex: Meeting January 15..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && noteTitle.trim() && !isCreatingNote && !isAddingToFolder) {
                  handleCreateNote();
                }
              }}
              autoFocus
            />
            {createNoteState && createNoteState.error && (
              <Alert variant="error">
                <Alert.Description>
                  {createNoteState.error}
                </Alert.Description>
              </Alert>
            )}
          </div>
        </Modal.Content>
        <Modal.Footer>
          <div className="flex gap-2 justify-end w-full">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateNoteModal(false);
                setNoteTitle("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={!noteTitle.trim() || isCreatingNote || isAddingToFolder}
              variant="primary"
            >
              {isCreatingNote || isAddingToFolder ? (
                <>
                  <Icon name="spinner" className="w-4 h-4 animate-spin" />
                  {isAddingToFolder ? "Adding to folder..." : "Creating..."}
                </>
              ) : (
                <>
                  <Icon name="note" className="w-4 h-4" />
                  Create
                </>
              )}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </main>
  );
}
