"use client";
import WysiwygNotepad from "@/components/Paper.js/WysiwygNotepad";

import { useEffect, useState, useCallback } from "react";
import { useLocalSession } from "@/hooks/useLocalSession";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import TagsManager from "@/components/documents/TagsManager";

const LOCAL_DOCS_KEY = "notus.local.documents";

interface NotepadContent {
  text: string;
  timestamp?: number;
}

interface LocalDocument {
  id: string;
  title: string;
  content: NotepadContent | string;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

interface EditLocalDocumentPageClientProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function EditLocalDocumentPageClient({ params }: Readonly<EditLocalDocumentPageClientProps>) {
  const localSession = useLocalSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewQuery = searchParams?.get("isNew") === "1";
  const [document, setDocument] = useState<LocalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [showSavedState, setShowSavedState] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  // Handle async parameters
  const [docId, setDocId] = useState<string | null>(null);
  const [isNewDoc, setIsNewDoc] = useState(false);

  const [content, setContent] = useState<NotepadContent>(() => ({
    text: "",
  }));
  const [editorKey, setEditorKey] = useState(() => `new-${Date.now()}`);

  // Handle async parameters initialization
  useEffect(() => {
    const initializeParams = async () => {
      if (params) {
        const resolvedParams = await params;
        const id = resolvedParams?.id;
        const isNew = !id || id === "new";
        setDocId(id);
        setIsNewDoc(isNew);

        // Load document directly here instead of waiting for another useEffect
        if (isNew) {
          // New document
          setDocument(null);
          setTitle("");
          setContent({ text: "" });
          setEditorKey(`new-${Date.now()}`);
          setError(null);
          setLoading(false);
        } else {
          // Existing document
          const docs = loadLocalDocuments();
          const found = docs.find((d) => d.id === id);
          if (!found) {
            setError("Local document not found");
            setDocument(null);
          } else {
            setDocument(found);
            setTitle(found.title || "Untitled");
            // Load tags from doc or localStorage
            try {
              const rawTags = localStorage.getItem("notus.tags");
              const tagsMap = rawTags ? JSON.parse(rawTags) : {};
              const existing = Array.isArray(found.tags)
                ? found.tags
                : Array.isArray(tagsMap[String(found.id)])
                ? tagsMap[String(found.id)]
                : [];
              setTags(existing);
            } catch (_) {
              setTags([]);
            }
            // Normalize content for editor
            let normalized: NotepadContent;
            if (typeof found.content === "string") {
              try {
                normalized = JSON.parse(found.content);
              } catch {
                normalized = {
                  text: found.content,
                };
              }
            } else {
              normalized = found.content as NotepadContent;
            }
            setContent(
              normalized || { text: ""}
            );
            setEditorKey(`local-doc-${id}-${found.updated_at}`);
          }
          setLoading(false);
        }
      }
    };
    initializeParams();
  }, [params]);

  function handleCancelCreation() {
    if (!docId) {
      router.push("/app");
      return;
    }
    const docs = loadLocalDocuments();
    const updated = docs.filter((d) => d.id !== docId);
    saveLocalDocuments(updated);
    router.push("/app");
  }

  const loadLocalDocuments = (): LocalDocument[] => {
    try {
      const raw = localStorage.getItem(LOCAL_DOCS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  };

  const saveLocalDocuments = (docs: LocalDocument[]): boolean => {
    try {
      localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs));
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSave = async () => {
    const docs = loadLocalDocuments();

    // Build normalized content object
    const normalizedContentObj: NotepadContent = {
      text: content.text || "",
      timestamp: Date.now(),
    };
    const nowIso = new Date().toISOString();

    if (isNewDoc) {
      // Create a new document
      const newDoc: LocalDocument = {
        id: `local-${Date.now()}`,
        title: (title || "Untitled").trim(),
        content: normalizedContentObj,
        created_at: nowIso,
        updated_at: nowIso,
        tags: tags,
      };

      docs.push(newDoc);
      const ok = saveLocalDocuments(docs);
      if (!ok) {
        setError("Impossible to save locally (quota or permissions)");
        return;
      }
      // Persist tags for this document in notus.tags
      try {
        const raw = localStorage.getItem("notus.tags");
        const tagsMap = raw ? JSON.parse(raw) : {};
        tagsMap[String(newDoc.id)] = tags;
        localStorage.setItem("notus.tags", JSON.stringify(tagsMap));
      } catch (_) {}
      // Update local state and redirect to correct URL
      setDocument(newDoc);
      setIsNewDoc(false); // Mark as existing document
      setShowSavedState(true);

      // Redirect to URL with new ID
      setTimeout(() => {
        router.push(`/documents/local/${newDoc.id}`);
      }, 100);
    } else {
      // Update an existing document
      const idx = docs.findIndex((d) => d.id === docId);
      if (idx === -1) {
        setError("Local document not found");
        return;
      }

      docs[idx] = {
        ...docs[idx],
        title: (title || "Untitled").trim(),
        content: normalizedContentObj,
        updated_at: nowIso,
        tags: tags,
      };
      const ok = saveLocalDocuments(docs);
      if (!ok) {
        setError("Impossible to save locally (quota or permissions)");
        return;
      }
      // Persist tags for this document in notus.tags
      try {
        const raw = localStorage.getItem("notus.tags");
        const tagsMap = raw ? JSON.parse(raw) : {};
        tagsMap[String(docs[idx].id)] = tags;
        localStorage.setItem("notus.tags", JSON.stringify(tagsMap));
      } catch (_) {}
      // Update local state and stay on page
      setDocument(docs[idx]);
      setShowSavedState(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Error
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link
            href="/app"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Determine the content text for the document
  const contentText = document
    ? typeof document.content === "object" && document.content !== null
      ? (document.content as NotepadContent).text || ""
      : document.content || ""
    : "";

  return (
    <div className="h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/app"
            className="text-foreground font-semibold flex items-center"
          >
            <Icon name="arrowLeft" className="h-5 w-5 mr-2" />
            Back
          </Link>
        </div>

        {/* New note banner */}
        {isNewQuery && (
          <div className="mb-4 rounded-lg p-3 bg-muted flex items-center justify-between">
            <span className="text-sm text-muted-foreground">New note being created (local)</span>
            <button onClick={handleCancelCreation} className="text-foreground hover:opacity-80">Cancel creation</button>
          </div>
        )}

        {/* Saved message */}
        {showSavedState && (
          <div className="mb-4 rounded-lg p-4 bg-card border border-primary">
            <p className="text-sm text-primary">
              {isNewDoc
                ? "Document created successfully!"
                : "Document saved successfully!"}
            </p>
          </div>
        )}

        {/* Content */}
        <div className="bg-card rounded-2xl border border-border p-6 overflow-hidden">
          <div className="space-y-6">
            {/* Tags */}
            <div className="mb-1">
              <TagsManager
                tags={tags}
                onTagsChange={setTags}
                placeholder="Add a tag..."
                maxTags={20}
                className="w-full"
                currentUserId={localSession?.userId}
                requireAuth={true}
              />
            </div>

            {/* Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setShowSavedState(false); }}
                className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-transparent text-foreground text-xl font-semibold"
                placeholder="Document title"
                maxLength={255}
              />
            </div>

            {/* Editor */}
            <div>
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <WysiwygNotepad
                  key={editorKey}
                  initialData={content}
                  onContentChange={(val: unknown) => {
                    if (typeof val === "string") {
                      try {
                        const parsed = JSON.parse(val) as NotepadContent;
                        setContent(parsed);
                        setShowSavedState(false);
                      } catch {
                        setContent({
                          text: val,
                        });
                        setShowSavedState(false);
                      }
                    } else {
                      const typed = val as NotepadContent;
                      setContent(typed);
                      setShowSavedState(false);
                    }
                  }}
                  placeholder="Start writing your document..."
                  className=""
                  showDebug={false}
                />
              </div>
            </div>

            <div className="flex justify-center space-x-4 pt-2 shrink-0">
              <Button
                type="button"
                onClick={handleSave}
                disabled={showSavedState}
                className={`bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-muted disabled:cursor-not-allowed font-semibold py-3 px-6 rounded-lg transition-colors`}
              >
                {showSavedState
                  ? isNewDoc
                    ? "Created"
                    : "Saved"
                  : isNewDoc
                    ? "Create document"
                    : "Save"}
              </Button>
              {isNewQuery ? (
                <button
                  type="button"
                  onClick={handleCancelCreation}
                  className="px-6 py-3 rounded-lg text-foreground hover:shadow-md hover:border-primary hover:bg-foreground/5 border border-primary cursor-pointer"
                >
                  Cancel
                </button>
              ) : (
                <Link
                  href="/app"
                  className="px-6 py-3 rounded-lg text-foreground hover:shadow-md hover:border-primary hover:bg-foreground/5 border border-primary cursor-pointer"
                >
                  Cancel
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
