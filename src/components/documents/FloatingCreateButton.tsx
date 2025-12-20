"use client";

import { useLocalSession } from "@/hooks/useLocalSession";
import { usePathname, useRouter } from "next/navigation";
import { useSelection } from "@/contexts/SelectionContext";
import type { Session } from "next-auth";
import Icon from "@/components/Icon";
import { useActionState, startTransition, useEffect } from "react";
import { createDocumentAction } from "@/actions/documentActions";

interface FloatingCreateButtonProps {
  serverSession?: Session | null;
}

export default function FloatingCreateButton({ serverSession }: Readonly<FloatingCreateButtonProps>) {
  const { loading, isLoggedIn, userId } = useLocalSession(serverSession);
  const { isSelectModeActive } = useSelection();
  const pathname = usePathname();
  const router = useRouter();
  interface CreateDocumentActionResult {
    success?: boolean;
    documentId?: number;
    error?: string;
  }

  const [createState, createAction] = useActionState(
    createDocumentAction as unknown as (prev: CreateDocumentActionResult | null, fd: FormData) => Promise<CreateDocumentActionResult>,
    null
  );

  useEffect(() => {
    const id = createState?.documentId;
    if (id) {
      router.push(`/documents/${encodeURIComponent(String(id))}?isNew=1`);
    }
  }, [createState, router]);

  if (loading || pathname !== "/app") {
    return null;
  }

  const getBottomClass = () => {
    const isHomePage = pathname === "/app";
    const hasConnectionWarning = !isLoggedIn && isHomePage;
    if (isSelectModeActive && hasConnectionWarning) { return "bottom-32"; }
    else { return "bottom-20"; }
  };

  const bottomClass = getBottomClass();

  async function handleCreate() {
    if (!isLoggedIn) {
      const LOCAL_DOCS_KEY = "notus.local.documents";
      const nowIso = new Date().toISOString();
      const localId = `local-${Date.now()}`;
      try {
        const raw = localStorage.getItem(LOCAL_DOCS_KEY);
        const docs = raw ? JSON.parse(raw) : [];
        const newDoc = {
          id: localId,
          title: "Untitled",
          content: { text: "", timestamp: Date.now() },
          created_at: nowIso,
          updated_at: nowIso,
          tags: [],
        };
        const next = Array.isArray(docs) ? [...docs, newDoc] : [newDoc];
        localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(next));
      } catch {
        // Ignore local storage errors
      }
      router.push(`/documents/local/${encodeURIComponent(localId)}?isNew=1`);
      return;
    }

    const fd = new FormData();
    fd.set("title", "New note");
    fd.set("content", "");
    if (userId) fd.set("userId", String(userId));
    startTransition(() => { createAction(fd); });
  }

  return (
    <div className={`fixed ${bottomClass} left-0 right-0 z-10 px-0 md:ml-68 md:px-4`}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            className="whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer px-4 py-4 md:py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group inline-flex items-center gap-3"
            title="Create a note"
          >
            <span className="font-title text-xl md:flex hidden">Create a note</span>
            <Icon name="plus" className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}


