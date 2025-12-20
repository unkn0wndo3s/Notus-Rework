"use client";
import { useActionState, startTransition } from "react";
import { Button } from "@/components/ui";
import { createDocumentAction } from "@/lib/actions";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useLocalSession } from "@/hooks/useLocalSession";
import WysiwygNotepad from "@/components/Paper.js/WysiwygNotepad";
import type { Session } from "next-auth";

interface NewDocumentPageClientProps {
  session?: Session | null;
}

interface NotepadContent {
  text: string;
  timestamp?: number;
}

export default function NewDocumentPageClient(props: Readonly<NewDocumentPageClientProps>) {
  // -------- State management --------
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<NotepadContent>({
    text: "",
  });
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showSavedState, setShowSavedState] = useState(false);

  // Action state
  const [state, formAction, isPending] = useActionState(createDocumentAction, {
    success: false,
    message: "",
    documentId: 0,
  });

  // Session management
  const {
    session: localSession,
    loading: sessionLoading,
    isLoggedIn,
    userId,
  } = useLocalSession(props.session);

  // -------- Content normalization --------
  const normalizeContent = (rawContent: unknown): NotepadContent => {
    if (!rawContent) return { text: ""};

    let content: unknown = rawContent;

    // Parse if string
    if (typeof content === "string") {
      const stringContent = content;
      try {
        content = JSON.parse(stringContent);
      } catch {
        return { text: stringContent };
      }
    }

    // Ensure proper structure
    interface ParsedContent {
      text?: string;
      timestamp?: number;
    }
    const parsed = content as ParsedContent;
    return {
      text: parsed.text || "",
      timestamp: parsed.timestamp || Date.now(),
    };
  };

  // -------- Content change handling --------
  const handleContentChange = useCallback((newContent: unknown) => {
    const normalized = normalizeContent(newContent);
    setContent(normalized);
  }, []);

  // -------- Success message handling --------
  const handleSuccess = useCallback(
    (documentId: string | number) => {
      setShowSuccessMessage(true);
      setShowSavedState(true);

      const savedTimer = setTimeout(() => setShowSavedState(false), 1500);
      const messageTimer = setTimeout(() => {
        setShowSuccessMessage(false);
        router.push(`/documents/${documentId}`);
      }, 2000);

      return () => {
        clearTimeout(savedTimer);
        clearTimeout(messageTimer);
      };
    },
    [router]
  );

  // -------- Save handling --------
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault?.();

      const submittingUserId =
        userId ?? (localSession as { id?: number } | null)?.id ?? props.session?.user?.id;
      if (!submittingUserId) {
        alert("Invalid session. Please log in again.");
        return;
      }

      // Build content object
      const contentToSave = {
        text: content.text || "",
        timestamp: Date.now(),
      };

      // Prepare form data
      const formData = new FormData();
      formData.append("userId", String(submittingUserId));
      formData.append("title", title || "Untitled");
      formData.append("content", JSON.stringify(contentToSave));
      formData.append("tags", JSON.stringify([]));

      // Submit
      startTransition(() => {
        formAction(formData);
      });
    },
    [
      content,
      userId,
      localSession,
      props.session,
      title,
      formAction,
    ]
  );

  interface CreateDocumentState {
    success?: boolean;
    documentId?: number;
    error?: string;
    message?: string;
  }

  // Handle successful creation
  useEffect(() => {
    console.log("State received:", state);
    const typedState = state as CreateDocumentState;
    if (typedState && typedState.success && typedState.documentId) {
      console.log("Redirecting to document:", typedState.documentId);
      handleSuccess(typedState.documentId);
    }
  }, [state, handleSuccess]);

  // -------- Loading states --------
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary">
            Loading session...
          </p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Access Denied
          </h1>
          <p className="text-muted-foreground mb-6">
            You must be logged in to create a document.
          </p>
          <Link
            href="/login"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  // -------- Main render --------
  return (
    <div className="min-h-screen bg-background py-8">
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

        {/* Create form */}
        <div className="bg-card rounded-2xl border border-border p-6 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-transparent text-foreground text-xl font-semibold"
                placeholder="Document title"
                maxLength={255}
              />
            </div>

            {/* Content */}
            <div>
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <WysiwygNotepad
                  initialData={content}
                  onContentChange={handleContentChange}
                  placeholder="Start writing your document..."
                  className=""
                  showDebug={false}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-center space-x-4">
              <Button variant="ghost" className="px-6 py-3" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className={`bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-muted disabled:cursor-not-allowed font-semibold py-3 px-6 rounded-lg transition-colors`}
              >
                {isPending
                  ? "Saving..."
                  : showSavedState
                    ? "Saved"
                    : "Save"}
              </Button>
            </div>

            {/* Success/Error messages */}
            {(showSuccessMessage || (state && (state as CreateDocumentState).error)) && (
              <div
                className={`shrink-0 rounded-lg p-4 mt-4 ${
                  showSuccessMessage
                    ? "bg-card border border-primary"
                    : "bg-destructive/10 border border-destructive/20"
                }`}
              >
                <p
                  className={`text-sm ${
                    showSuccessMessage
                      ? "text-primary"
                      : "text-destructive"
                  }`}
                >
                  {showSuccessMessage
                    ? "Document created successfully!"
                    : (state as CreateDocumentState)?.error || "Error during creation"}
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
