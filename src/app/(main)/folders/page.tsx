"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/navigation/NavBar";
import ContentWrapper from "@/components/common/ContentWrapper";
import { Button } from "@/components/ui/button";
import {
  Card,
  Modal,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui";
import Icon from "@/components/Icon";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

import { getFolders, createFolder, deleteFolder } from "@/actions/folderActions";

interface Folder {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
  documentCount: number;
}

export default function FoldersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      loadFolders();
    }
  }, [session]);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const result = await getFolders();
      if (result.success) {
        setFolders(result.folders || []);
      }
    } catch (error) {
      console.error("Error loading folders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreating(true);
    try {
      const result = await createFolder(newFolderName.trim());
      if (result.success) {
        setShowCreateModal(false);
        setNewFolderName("");
        loadFolders();
      } else {
        alert(result.error || "Error creating folder");
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Error creating folder");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteFolder = async (id: number) => {
    if (!confirm("Are you sure you want to delete this folder?")) return;
    setDeletingId(id);
    try {
      const result = await deleteFolder(id);
      if (result.success) {
        loadFolders();
      } else {
        alert(result.error || "Error deleting folder");
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Error deleting folder");
    } finally {
      setDeletingId(null);
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

  return (
    <main className="min-h-screen bg-background">
      <NavBar />
      <ContentWrapper maxWidth="lg">
        <section className="space-y-6">
          <header className="flex items-center md:justify-between justify-start mb-4 gap-2 flex-wrap">
            <div>
              <h1 className="font-title text-4xl font-regular text-[var(--foreground)] hidden md:block mb-2">
                Folders
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] hidden md:block">
                Organize your documents in folders
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Icon name="plus" className="w-5 h-5" />
              <span className="">Create a folder</span>
            </Button>
          </header>

          {isLoading ? (
            <div className="text-center py-16">
              <Icon name="spinner" className="w-10 h-10 mx-auto animate-spin text-[var(--primary)]" />
              <p className="mt-4 text-[var(--muted-foreground)]">Loading folders...</p>
            </div>
          ) : folders.length === 0 ? (
            <Card className="text-center py-16">
              <Card.Content>
                <div className="text-[var(--muted-foreground)] mb-6">
                  <Icon name="folder" className="w-20 h-20 mx-auto opacity-50" />
                </div>
                <Card.Title className="text-xl mb-3 font-semibold">No folders</Card.Title>
                <Card.Description className="mb-6">
                  Create your first folder to organize your documents
                </Card.Description>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 mx-auto"
                >
                  <Icon name="plus" className="w-5 h-5" />
                  <span>Create a folder</span>
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map((folder) => {
                const formatDate = (dateInput: string | Date | undefined) => {
                  if (!dateInput) return "";
                  const date = new Date(dateInput);
                  const day = String(date.getDate()).padStart(2, "0");
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const year = date.getFullYear();
                  return `${day}/${month}/${year}`;
                };

                return (
                  <Card
                    key={folder.id}
                    className={cn(
                      "group cursor-pointer overflow-hidden",
                      "bg-[var(--card)] border border-[var(--border)]",
                      "hover:shadow-lg",
                      "transition-all duration-200 ease-in-out"
                    )}
                    onClick={() => router.push(`/folders/${folder.id}`)}
                  >
                    <Card.Content className="">
                      {/* Header with icon and menu */}
                      <div className="flex items-start justify-between mb-6">
                        {/* Folder icon top left */}
                        <div className={cn(
                          "flex items-center justify-center",
                          "w-14 h-14 rounded-xl",
                          "bg-[var(--primary)]/10 text-[var(--primary)]",
                          "shrink-0"
                        )}>
                          <Icon name="folder" className="w-8 h-8 block" />
                        </div>
                        {/* Three dots menu top right */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "p-2 rounded-md shrink-0",
                                "text-[var(--muted-foreground)]",
                                "hover:bg-[var(--muted)]",
                                "transition-colors duration-200",
                              )}
                              aria-label="Folder options"
                            >
                              <Icon name="dotsVertical" className="w-5 h-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id);
                              }}
                              disabled={deletingId === folder.id}
                            >
                              {deletingId === folder.id ? (
                                <>
                                  <Icon name="spinner" className="w-4 h-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Icon name="trash" className="w-4 h-4" />
                                  Delete
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Folder name center */}
                      <h3 className="font-bold text-[var(--foreground)] text-xl mb-6 line-clamp-2">
                        {folder.name}
                      </h3>

                      {/* Footer with note count and date */}
                      <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
                        <span>
                          {folder.documentCount} note{folder.documentCount > 1 ? "s" : ""}
                        </span>
                        <span>
                          {formatDate(folder.updated_at)}
                        </span>
                      </div>
                    </Card.Content>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </ContentWrapper>

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewFolderName("");
        }}
        title="Create a folder"
        size="md"
      >
        <Modal.Content>
          <div className="space-y-4">
            <Input
              label="Folder name"
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex: Projects, Personal Notes..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim() && !isCreating) {
                  handleCreateFolder();
                }
              }}
              autoFocus
            />
          </div>
        </Modal.Content>
        <Modal.Footer>
          <div className="flex gap-2 justify-end w-full">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                setNewFolderName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || isCreating}
              variant="primary"
            >
              <Icon name="plus" className="w-4 h-4" />
              Create
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </main>
  );
}
