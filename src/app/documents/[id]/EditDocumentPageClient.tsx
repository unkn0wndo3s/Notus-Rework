"use client";
import { startTransition, useActionState, useState, useEffect, useCallback, useRef } from "react";
import { Button, Modal } from "@/components/ui";
import MenuItem from "@/components/ui/overlay/overlay-menu-item";
import { Input } from "@/components/ui/input";
import {
  updateDocumentAction,
  addShareAction,
  deleteDocumentAction,
  createDocumentAction,
  getDocumentByIdAction,
  fetchDocumentAccessListAction
} from "@/actions/documentActions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocalSession } from "@/hooks/useLocalSession";
import WysiwygNotepad from "@/components/Paper.js/WysiwygNotepad";
import { Document, ActionResult } from "@/lib/types";
import TagsManager from "@/components/documents/TagsManager";
import CommentsSidebar from "@/components/documents/CommentsSidebar";
import HistorySidebar from "@/components/documents/HistorySidebar";
import SynthesisSidebar from "@/components/documents/SynthesisSidebar";
import UserListButton from "@/components/ui/UserList/UserListButton";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";
import { useCollaborativeTitle } from "@/lib/paper.js/useCollaborativeTitle";
import sanitizeLinks from "@/lib/sanitizeLinks";
import Icon from "@/components/Icon";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import ExportOverlay from "@/components/Paper.js/Editor/ExportOverlay";

interface EditDocumentPageClientProps {
  session?: Session | null;
  params: { id: string };
}

interface NotepadContent {
  text: string;
  timestamp?: number;
}

type SaveStatus = "synchronized" | "saving" | "unsynchronized";

const getSaveStatusLabel = (status: SaveStatus): string => {
  switch (status) {
    case "synchronized":
      return "Note synchronized";
    case "saving":
      return "Saving...";
    case "unsynchronized":
    default:
      return "Not synchronized";
  }
};

type FlushOverride = {
  markdown?: string;
  content?: NotepadContent;
  title?: string;
  tags?: string[];
};

const toPositiveNumber = (raw: unknown): number | undefined => {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
};

export default function EditDocumentPageClient(props: Readonly<EditDocumentPageClientProps>) {
  // -------- All Hooks must be called unconditionally first --------

  const {
    session: localSession,
    loading: sessionLoading,
    isLoggedIn,
    userId,
    userEmail,
  } = useLocalSession(props.session);

  // Router
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = searchParams?.get("isNew") === "1";
  const { guardedNavigate, checkConnectivity } = useGuardedNavigate();

  // Action state (must be before any conditional returns)
  const [deleteState, deleteAction] = useActionState(
    deleteDocumentAction as unknown as (prev: any, fd: FormData) => Promise<string>,
    ""
  );

  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<NotepadContent>({
    text: "",
  });

  async function handleCancelCreation() {
    const fd = new FormData();
    if (document?.id) fd.set("documentId", String(document.id));
    if (userId) fd.set("userId", String(userId));
    startTransition(() => {
      deleteAction(fd);
    });
    router.push("/app");
  }
  const [tags, setTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showSavedState, setShowSavedState] = useState(false);
  const [showSavedNotification, setShowSavedNotification] = useState(false);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);


  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [permission, setPermission] = useState("read");
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [hasEditAccess, setHasEditAccess] = useState<boolean | null>(null);
  const [hasReadAccess, setHasReadAccess] = useState<boolean | null>(null);
  const [users, setUsers] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSynthesisOpen, setIsSynthesisOpen] = useState(false);
  
  // Load access list for this document and update `users` state
  const loadAccessList = async () => {
    if (!document?.id) return;
    // Do not load the access list in offline mode
    if (isOffline || !navigator.onLine) {
      return;
    }
    try {
      const onlineOk = await checkConnectivity();
      if (!onlineOk) return;
      
      const result = await fetchDocumentAccessListAction(Number(document.id));
      if (result.success && result.data && Array.isArray(result.data.accessList)) {
        setUsers(
          result.data.accessList.map((user: any) => ({
            ...user,
            avatarUrl: user.profile_image || "",
            name: user.username || user.email || "User",
          }))
        );
      } else {
        setUsers([]);
      }
    } catch (e) {
      console.error("Error loading access list:", e);
      setUsers([]);
    }
  };
  const [offlineBaseline, setOfflineBaseline] = useState<string>("");

  // Save status: 'synchronized' | 'saving' | 'unsynchronized'
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("synchronized");
  const lastSavedContentRef = useRef<string>("");
  const lastSavedTitleRef = useRef<string>("");
  const lastSavedTagsRef = useRef<string[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const flushRealtimeRef = useRef<(override?: FlushOverride) => Promise<void>>(async () => { });
  const persistIndicatorsRef = useRef<{
    saved?: NodeJS.Timeout;
    message?: NodeJS.Timeout;
    notification?: NodeJS.Timeout;
  }>({});
  const shouldUseRealtime = isRealtimeConnected && !isOffline;
  const realtimeUserId = toPositiveNumber(userId) ?? toPositiveNumber(props.session?.user?.id);

  const triggerPersistIndicators = useCallback(() => {
    if (persistIndicatorsRef.current.saved) {
      clearTimeout(persistIndicatorsRef.current.saved);
    }
    if (persistIndicatorsRef.current.message) {
      clearTimeout(persistIndicatorsRef.current.message);
    }
    if (persistIndicatorsRef.current.notification) {
      clearTimeout(persistIndicatorsRef.current.notification);
    }

    setShowSuccessMessage(true);
    setShowSavedState(true);
    setShowSavedNotification(true);

    persistIndicatorsRef.current.saved = setTimeout(() => setShowSavedState(false), 1500);
    persistIndicatorsRef.current.message = setTimeout(() => setShowSuccessMessage(false), 3000);
    persistIndicatorsRef.current.notification = setTimeout(() => setShowSavedNotification(false), 2000);
  }, []);

  const handleSyncStatusChange = useCallback(
    (status: SaveStatus) => {
      setSaveStatus(status);
      if (status === 'saving') {
        isSavingRef.current = true;
      } else if (status === 'synchronized') {
        isSavingRef.current = false;
      }
    },
    []
  );

  const buildContentSnapshot = useCallback((): NotepadContent => {
    return {
      text: sanitizeLinks(content.text || ""),
      timestamp: Date.now(),
    };
  }, [content]);

  const handleRealtimePersisted = useCallback(
    ({
      snapshot,
      title: persistedTitle,
      tags: persistedTags,
    }: {
      snapshot?: NotepadContent | null;
      title?: string;
      tags?: string[];
    }) => {
      const nextSnapshot = snapshot || buildContentSnapshot();
      lastSavedContentRef.current = JSON.stringify(nextSnapshot);
      lastSavedTitleRef.current = persistedTitle ?? title;
      lastSavedTagsRef.current = persistedTags ? [...persistedTags] : [...tags];
      setSaveStatus('synchronized');
      isSavingRef.current = false;
      triggerPersistIndicators();
    },
    [buildContentSnapshot, tags, title, triggerPersistIndicators]
  );

  const handleRegisterFlush = useCallback((flush: (override?: FlushOverride) => Promise<void>) => {
    flushRealtimeRef.current = flush;
  }, []);

  const handleRealtimeConnectionChange = useCallback((connected: boolean) => {
    setIsRealtimeConnected(connected);
  }, []);

  const flushTitleRealtime = useCallback(
    (nextTitle: string) => {
      if (!shouldUseRealtime) return;
      const snapshot = buildContentSnapshot();
      const markdown = snapshot.text || "";
      flushRealtimeRef.current({
        markdown,
        content: snapshot,
        title: nextTitle,
        tags,
      }).catch((error) => {
        console.error("❌ Failed to synchronize title via websocket:", error);
        setSaveStatus('unsynchronized');
      });
    },
    [shouldUseRealtime, buildContentSnapshot, tags, setSaveStatus]
  );

  const createPersonalCopyFromOffline = useCallback(
    async (snapshot: NotepadContent) => {
      if (!realtimeUserId) return;
      try {
        const copyForm = new FormData();
        copyForm.append("userId", String(realtimeUserId));
        const baseTitle = title || "Untitled";
        copyForm.append("title", `${baseTitle} (personal copy)`);
        copyForm.append("content", JSON.stringify(snapshot));
        copyForm.append("tags", JSON.stringify(tags));
        await createDocumentAction(undefined as unknown as never, copyForm);
        console.log("📄 Personal copy created following a remote modification.");
      } catch (error) {
        console.error("❌ Unable to create a personal copy:", error);
      }
    },
    [realtimeUserId, title, tags]
  );

  useEffect(() => {
    const timersRef = persistIndicatorsRef.current;
    return () => {
      flushRealtimeRef.current = async () => { };
      if (timersRef.saved) {
        clearTimeout(timersRef.saved);
      }
      if (timersRef.message) {
        clearTimeout(timersRef.message);
      }
      if (timersRef.notification) {
        clearTimeout(timersRef.notification);
      }
    };
  }, []);

  // Collaborative title synchronization
  const { emitTitleChange, isConnected: isTitleConnected } = useCollaborativeTitle({
    roomId: document ? String(document.id) : undefined,
    onRemoteTitle: (remoteTitle: string) => {
      setTitle(remoteTitle);
      // Update localStorage with remote title change
      updateLocalStorage(content, remoteTitle);
    },
  });

  const normalizeContent = useCallback((rawContent: unknown): NotepadContent => {
    if (!rawContent) return { text: "" };

    let content: unknown = rawContent;

    if (typeof content === "string") {
      const stringContent = content;
      try {
        content = JSON.parse(stringContent);
      } catch {
        return { text: stringContent };
      }
    }

    interface ParsedContent {
      text?: string;
      timestamp?: number;
    }
    const parsed = content as ParsedContent;
    return {
      text: parsed.text || "",
      timestamp: parsed.timestamp || Date.now(),
    };
  }, []);

  const loadDocument = useCallback(async () => {
    try {
      setIsLoading(true);

      // If offline, load from localStorage
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const cached = localStorage.getItem(`notus:doc:${props.params.id}`);
        if (cached) {
          try {
            const c = JSON.parse(cached);
            setDocument({
              id: Number(c.id),
              title: c.title,
              content: JSON.stringify(normalizeContent(c.content)),
              tags: Array.isArray(c.tags) ? c.tags : [],
              created_at: new Date(c.created_at || c.updated_at),
              updated_at: new Date(c.updated_at),
              user_id: Number(c.user_id ?? Number.NaN),
            });
            setTitle(c.title);
            setContent(normalizeContent(c.content));
            setTags(Array.isArray(c.tags) ? c.tags : []);

            const cachedContentString = JSON.stringify(normalizeContent(c.content));
            lastSavedContentRef.current = cachedContentString;
            lastSavedTitleRef.current = c.title;
            lastSavedTagsRef.current = Array.isArray(c.tags) ? c.tags : [];
            setSaveStatus('synchronized');
            setError(null);
            setIsLoading(false);
            return;
          } catch (e) {
            console.error("Error loading from localStorage:", e);
          }
        }
        setError("Document not available offline");
        setIsLoading(false);
        return;
      }

      const actionResult = await getDocumentByIdAction(Number(props.params.id));
      if (actionResult.success && actionResult.document) {
        const { document: doc } = actionResult;
        const normalizedContent = normalizeContent(doc.content);
        const docObj = {
          id: Number(props.params.id),
          title: doc.title,
          content: JSON.stringify(normalizedContent),
          tags: Array.isArray(doc.tags) ? doc.tags : [],
          created_at: new Date(doc.created_at || doc.updated_at),
          updated_at: new Date(doc.updated_at),
          user_id: Number(doc.user_id ?? Number.NaN),
        };
        setDocument(docObj);
        setTitle(doc.title);
        setContent(normalizedContent);
        setTags(Array.isArray(doc.tags) ? doc.tags : []);

        // Initialize refs with the loaded content
        const contentString = JSON.stringify(normalizedContent);
        lastSavedContentRef.current = contentString;
        lastSavedTitleRef.current = doc.title;
        lastSavedTagsRef.current = Array.isArray(doc.tags) ? doc.tags : [];
        setSaveStatus('synchronized');

        try {
          const cachePayload = {
            id: Number(props.params.id),
            title: doc.title,
            content: normalizedContent,
            tags: Array.isArray(doc.tags) ? doc.tags : [],
            updated_at: doc.updated_at,
            user_id: Number(doc.user_id ?? Number.NaN),
            cachedAt: Date.now(),
          };
          if (typeof window !== "undefined") {
            localStorage.setItem(`notus:doc:${props.params.id}`,
              JSON.stringify(cachePayload)
            );
          }
        } catch { }
      } else {
        try {
          if (typeof globalThis.window !== "undefined") {
            const cached = localStorage.getItem(`notus:doc:${props.params.id}`);
            if (cached) {
              const c = JSON.parse(cached);
              setDocument({
                id: Number(c.id),
                title: c.title,
                content: JSON.stringify(normalizeContent(c.content)),
                tags: Array.isArray(c.tags) ? c.tags : [],
                created_at: new Date(c.created_at || c.updated_at),
                updated_at: new Date(c.updated_at),
                user_id: Number(c.user_id ?? Number.NaN),
              });
              setTitle(c.title);
              setContent(normalizeContent(c.content));
              setTags(Array.isArray(c.tags) ? c.tags : []);

              // Initialize refs with the cached content
              const cachedContentString = JSON.stringify(normalizeContent(c.content));
              lastSavedContentRef.current = cachedContentString;
              lastSavedTitleRef.current = c.title;
              lastSavedTagsRef.current = Array.isArray(c.tags) ? c.tags : [];
              setSaveStatus('synchronized');

              setError(null);
              return;
            }
          }
        } catch (err) {
          console.error("Error loading from local storage cache:", err);
        }
        
        // Final fallback if cache also fails
        setError(actionResult.error || "Error loading document");
      }
    } catch (err) {
      try {
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem(`notus:doc:${props.params.id}`);
          if (cached) {
            const c = JSON.parse(cached);
            setDocument({
              id: Number(c.id),
              title: c.title,
              content: JSON.stringify(normalizeContent(c.content)),
              tags: Array.isArray(c.tags) ? c.tags : [],
              created_at: new Date(c.created_at || c.updated_at),
              updated_at: new Date(c.updated_at),
              user_id: Number(c.user_id ?? Number.NaN),
            });
            setTitle(c.title);
            setContent(normalizeContent(c.content));
            setTags(Array.isArray(c.tags) ? c.tags : []);

            // Initialize refs with the cached content
            const cachedContentString = JSON.stringify(normalizeContent(c.content));
            lastSavedContentRef.current = cachedContentString;
            lastSavedTitleRef.current = c.title;
            lastSavedTagsRef.current = Array.isArray(c.tags) ? c.tags : [];
            setSaveStatus('synchronized');

            setError(null);
            return;
          }
        }
      } catch { }
      setError("Error loading document");
    } finally {
      setIsLoading(false);
    }
  }, [props.params.id, normalizeContent]);

  useEffect(() => {
    if (isLoggedIn && props.params?.id && userId) {
      loadDocument();
    }
  }, [isLoggedIn, props.params?.id, userId, loadDocument]);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      const normalizedContent = normalizeContent(document.content);
      setContent(normalizedContent);

      // Initialize refs if they are not already initialized
      if (lastSavedContentRef.current === "") {
        const contentString = JSON.stringify(normalizedContent);
        lastSavedContentRef.current = contentString;
        lastSavedTitleRef.current = document.title;
        lastSavedTagsRef.current = document.tags || [];
        setSaveStatus('synchronized');
      }

      // Do not load the access list in offline mode
      if (!isOffline && navigator.onLine) {
        checkConnectivity().then(onlineOk => {
          if (!onlineOk) return;
          fetchDocumentAccessListAction(Number(document.id))
            .then(result => {
              if (result.success && result.data && Array.isArray(result.data.accessList)) {
                setUsers(
                  result.data.accessList.map((user: any) => ({
                    ...user,
                    avatarUrl: user.profile_image || "",
                    name: user.username || user.email || "User",
                  }))
                );
              } else {
                setUsers([]);
              }
            })
            .catch(() => setUsers([]));
        });
      }
    }
  }, [document, normalizeContent, checkConnectivity, isOffline]);

  const isOwner = document ? Number(document.user_id) === Number(userId) : false;

  useEffect(() => {
    const key = `notus:doc:${props.params.id}`;
    const handleBeforeUnload = () => {
      try {
        localStorage.removeItem(key);
      } catch { }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      if (typeof globalThis.window !== "undefined") {
        globalThis.window.removeEventListener("beforeunload", handleBeforeUnload);
        try {
          localStorage.removeItem(key);
        } catch (ignored) {
          // Ignore
        }
      }
    };
  }, [props.params.id]);

  // Utility function to update localStorage with current state
  const updateLocalStorage = useCallback((contentToSave: NotepadContent, titleToSave?: string) => {
    try {
      if (typeof window !== "undefined") {
        const key = `notus:doc:${props.params.id}`;
        const cachedRaw = localStorage.getItem(key);
        const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
        const payload = {
          ...(cached || {}),
          id: Number(props.params.id),
          title: titleToSave ?? title,
          content: contentToSave,
          tags: tags,
          updated_at: new Date().toISOString(),
          user_id: cached?.user_id ?? Number(userId ?? (props.session?.user?.id ?? 0)),
          cachedAt: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(payload));
      }
    } catch (err) {
    }
  }, [props.params.id, title, tags, userId, props.session]);

  // Function to trigger automatic save with debounce
  // Note: handleSubmit will be defined later, we will use a ref to call it
  const handleSubmitRef = useRef<(() => Promise<void>) | null>(null);

  const triggerAutoSave = useCallback(() => {
    if (shouldUseRealtime) {
      return;
    }
    if (!document?.id || hasEditAccess === false || isSavingRef.current) {
      return;
    }

    // NEVER try to save if offline - save locally only
    if (isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      // Just mark as unsynchronized, but don't try to save via API
      setSaveStatus('unsynchronized');
      return;
    }

    // Cancel the previous timeout if it exists
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Mark as unsynchronized immediately
    setSaveStatus((prevStatus) => {
      if (prevStatus !== 'saving') {
        return 'unsynchronized';
      }
      return prevStatus;
    });

    // Trigger save after 2 seconds of inactivity
    saveTimeoutRef.current = setTimeout(async () => {
      // Check for changes at the time of saving
      const currentContentString = JSON.stringify(content);
      const hasChanges =
        currentContentString !== lastSavedContentRef.current ||
        title !== lastSavedTitleRef.current ||
        JSON.stringify(tags) !== JSON.stringify(lastSavedTagsRef.current);

      if (!hasChanges || isSavingRef.current) {
        // No changes, set back to synchronized
        setSaveStatus('synchronized');
        return;
      }

      // Double check we're not offline before attempting to save
      if (isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setSaveStatus('unsynchronized');
        return;
      }

      try {
        const onlineOk = await checkConnectivity();
        if (!onlineOk) {
          setSaveStatus('unsynchronized');
          return;
        }

        isSavingRef.current = true;
        setSaveStatus('saving');

        // Call handleSubmit via the ref
        if (handleSubmitRef.current) {
          await handleSubmitRef.current();
        }
      } catch (err) {
        // Silent error handling for autosave
        isSavingRef.current = false;
        setSaveStatus('unsynchronized');
      }
    }, 2000); // 2 seconds of inactivity before saving
  }, [document?.id, hasEditAccess, content, title, tags, checkConnectivity, shouldUseRealtime, isOffline]);

  const handleContentChange = useCallback((newContent: unknown) => {
    const normalized = normalizeContent(newContent);
    setContent(normalized);
    updateLocalStorage(normalized);
    triggerAutoSave();
  }, [normalizeContent, updateLocalStorage, triggerAutoSave]);


  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault?.();

      const submittingUserId = String(
        userId ?? (localSession as { id?: number } | null)?.id ?? (props.session?.user?.id ?? "")
      );
      if (!submittingUserId) {
        alert("Invalid session. Please log in again.");
        return;
      }

      const contentToSave: NotepadContent = {
        text: sanitizeLinks(content.text || ""),
        timestamp: Date.now(),
      };

      if (shouldUseRealtime) {
        setIsManualSaving(true);
        try {
          await flushRealtimeRef.current({
            content: contentToSave,
            title,
            tags,
          });
        } catch (error) {
          setSaveStatus('unsynchronized');
        } finally {
          setIsManualSaving(false);
        }
        return;
      }

      const onlineOk = await checkConnectivity();
      if (!onlineOk) {
        try {
          const key = `notus:doc:${props.params.id}`;
          const cachedRaw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
          const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
          const payload = {
            ...(cached || {}),
            id: Number(props.params.id),
            title: title || "",
            content: contentToSave,
            tags: tags,
            updated_at: new Date().toISOString(),
            user_id: cached?.user_id ?? Number(userId ?? (props.session as any)?.user?.id ?? 0),
            cachedAt: Date.now(),
          };
          if (typeof window !== "undefined") {
            localStorage.setItem(key, JSON.stringify(payload));
          }
          triggerPersistIndicators();
        } catch {
          setSaveStatus('unsynchronized');
        }
        setSaveStatus('unsynchronized');
        return;
      }

      const formData = new FormData();
      formData.append("documentId", String(props.params?.id || ""));
      formData.append("userId", String(submittingUserId));
      formData.append("title", title || "");
      formData.append("content", JSON.stringify(contentToSave));
      formData.append("tags", JSON.stringify(tags));
      const submittingUserEmail = userEmail || props.session?.user?.email || "";
      formData.append("email", submittingUserEmail);

      setIsManualSaving(true);
      try {
        await (updateDocumentAction as unknown as (prev: any, payload: FormData) => Promise<any>)(undefined as any, formData);
        triggerPersistIndicators();
        setSaveStatus('synchronized');
      } catch (error) {
        console.error("❌ Error during fallback save:", error);
        setSaveStatus('unsynchronized');
      } finally {
        setIsManualSaving(false);
      }
    },
    [
      content,
      userId,
      localSession,
      props.session,
      props.params.id,
      title,
      tags,
      triggerPersistIndicators,
      checkConnectivity,
      flushRealtimeRef,
      setSaveStatus,
      shouldUseRealtime,
      userEmail,
    ]
  );

  // Assign handleSubmit to the ref for auto-save
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Update refs and status after a successful save
  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // -------- Offline/Online conflict resolution --------
  useEffect(() => {
    if (!document) return;

    const handleOffline = () => {
      setIsOffline(true);
      // Store baseline when going offline
      const baseline = content.text || "";
      setOfflineBaseline(baseline);
      localStorage.setItem(`notus:offline-baseline:${document.id}`, baseline);

      // Save the complete document in localStorage with the full state
      try {
        const key = `notus:doc:${document.id}`;
        const snapshot = buildContentSnapshot();
        const payload = {
          id: Number(document.id),
          title: title || "",
          content: content,
          contentSnapshot: snapshot, // Include the full snapshot
          tags: tags,
          updated_at: new Date().toISOString(),
          user_id: Number(document.user_id ?? userId ?? 0),
          cachedAt: Date.now(),
          offline: true, // Mark as offline save
        };
        if (typeof window !== "undefined") {
          localStorage.setItem(key, JSON.stringify(payload));
          // Also save in a specific key for offline documents
          localStorage.setItem(`notus:offline-doc:${document.id}`, JSON.stringify(payload));
        }
        console.log('📴 Offline mode activated - Document saved in localStorage:', {
          documentId: document.id,
          title: title,
          contentLength: content.text?.length || 0,
          snapshotTimestamp: snapshot?.timestamp,
        });
      } catch (err) {
        console.error("Error during offline save:", err);
      }
    };

    const handleOnline = async () => {
      setIsOffline(false);
      console.log('🌐 Reconnection detected - Starting conflict resolution');

      try {
        // Fetch current state from database using server action
        const actionResult = await getDocumentByIdAction(Number(document.id));
        
        if (actionResult.success && actionResult.document) {
          const { document: result } = actionResult;
          const remoteContent = normalizeContent(result.content);
          const remoteText = remoteContent.text || "";
          const storedBaseline = localStorage.getItem(`notus:offline-baseline:${document.id}`) || "";
          const currentText = content.text || "";

          console.log('📊 Data retrieved from database:', {
            documentId: document.id,
            title: result.title,
            updatedAt: result.updated_at,
            contentLength: remoteText.length,
            contentPreview: remoteText.substring(0, 100) + '...',
            tags: result.tags,
            hasContent: !!result.content,
            contentType: typeof result.content
          });

          console.log('🔍 Conflict analysis:', {
            documentId: document.id,
            baselineLength: storedBaseline.length,
            remoteLength: remoteText.length,
            currentLength: currentText.length,
            baselinePreview: storedBaseline.substring(0, 50) + '...',
            remotePreview: remoteText.substring(0, 50) + '...',
            currentPreview: currentText.substring(0, 50) + '...'
          });

          // Compare remote content with stored baseline
          if (remoteText !== storedBaseline) {
            // Remote changes occurred while offline - create a copy
            console.log('⚠️ Conflict detected - Remote changes found during disconnection');
            console.log('📄 Creating a copy with local modifications');

            const offlineSnapshot = buildContentSnapshot();

            // Create a copy with "name - copy"
            if (realtimeUserId) {
              try {
                const copyForm = new FormData();
                copyForm.append("userId", String(realtimeUserId));
                const baseTitle = title || result.title || "Untitled";
                copyForm.append("title", `${baseTitle} - copy`);
                copyForm.append("content", JSON.stringify(offlineSnapshot));
                copyForm.append("tags", JSON.stringify(tags));
                await createDocumentAction(undefined as unknown as never, copyForm);
                console.log("📄 Copy created with offline modifications.");
              } catch (error) {
                console.error("❌ Unable to create copy:", error);
              }
            }

            // Update document state with remote data
            setDocument({
              ...document,
              content: JSON.stringify(remoteContent),
              updated_at: new Date(result.updated_at)
            });

            // Update all local states with remote data
            setContent(remoteContent);
            setTitle(result.title);
            setTags(Array.isArray(result.tags) ? result.tags : []);

            // Update localStorage with remote data
            updateLocalStorage(remoteContent, result.title);

            setOfflineBaseline("");
            localStorage.removeItem(`notus:offline-baseline:${document.id}`);
            console.log('✅ Resolution complete - Copy created and remote data applied');
          } else {
            // No remote changes - our offline changes are safe to persist
            console.log('✅ No conflict - No remote changes detected');
            console.log('💾 Saving offline modifications');
            await handleSubmit();
            setOfflineBaseline("");
            localStorage.removeItem(`notus:offline-baseline:${document.id}`);
            console.log('✅ Offline modifications saved successfully');
          }
        } else {
          console.log('❌ Failed to fetch remote content:', actionResult.error);
        }
      } catch (err) {
        console.error('❌ Error resolving conflicts:', err);
      }
    };

    // Check initial state
    if (typeof navigator !== 'undefined') {
      const initialOffline = !navigator.onLine;
      setIsOffline(initialOffline);
      console.log('🔌 Initial connection state:', { isOffline: initialOffline });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [document, content, handleSubmit, normalizeContent, updateLocalStorage, buildContentSnapshot, createPersonalCopyFromOffline, userId, realtimeUserId, title, tags]);

  const persistTags = (nextTags: string[]) => {
    if (!userId) return;
    // Do not persist tags in offline mode
    if (isOffline || !navigator.onLine) {
      return;
    }
    
    const fd = new FormData();
    fd.append("documentId", String(props.params?.id || ""));
    fd.append("userId", String(userId));
    fd.append("title", title || "Untitled");
    fd.append("content", JSON.stringify(content || ""));
    fd.append("tags", JSON.stringify(nextTags));
    
    // Check connectivity before calling the API
    checkConnectivity().then(onlineOk => {
      if (onlineOk) {
        startTransition(() => {
          (updateDocumentAction as unknown as (prev: unknown, payload: FormData) => Promise<ActionResult>)(undefined, fd);
        });
      }
    });
  };

  const handleTagsChange = (nextTags: string[]) => {
    setTags(nextTags);
    setShowSavedState(false);
    if (typeof navigator !== "undefined" && navigator.onLine) {
      persistTags(nextTags);
    }
    triggerAutoSave();
  };

  // -------- Access control --------
  useEffect(() => {
    if (!document) {
      return;
    }

    async function checkAccess() {
      if (!userEmail) {
        setHasEditAccess(false);
        setHasReadAccess(false);
        setError('Access denied: missing user email');
        return;
      }
      try {
        if (!document) {
          setHasEditAccess(false);
          setHasReadAccess(false);
          setError('Access denied: document not found');
          return;
        }
        // Do not verify access in offline mode
        if (isOffline || !navigator.onLine) {
          // In offline, we assume access based on loaded document
          const isOwner = Number(document.user_id) === Number(userId);
          setHasEditAccess(isOwner);
          setHasReadAccess(true);
          return;
        }
        
        const onlineOk = await checkConnectivity();
        if (!onlineOk) {
          // In offline, we assume access based on loaded document
          const isOwner = Number(document.user_id) === Number(userId);
          setHasEditAccess(isOwner);
          setHasReadAccess(true);
          return;
        }
        
        const actionResult = await fetchDocumentAccessListAction(Number(document.id));
        const result = actionResult.success ? { success: true, accessList: actionResult.data?.accessList } : { success: false, accessList: [] };
        
        if (result.success && Array.isArray(result.accessList)) {
          const myEmail = String(userEmail).trim().toLowerCase();

          // Check if user is owner
          const isOwner = Number(document.user_id) === Number(userId);

          interface AccessListItem {
            email?: string;
            permission?: boolean;
          }
          // Check if user has any access (read or edit)
          const userAccess = result.accessList.find((u: AccessListItem) =>
            (u.email || "").trim().toLowerCase() === myEmail
          );

          if (isOwner) {
            setHasEditAccess(true);
            setHasReadAccess(true);
          } else if (userAccess) {
            // User has shared access - check permission level
            setHasReadAccess(true);
            setHasEditAccess(userAccess.permission === true);
          } else {
            setHasEditAccess(false);
            setHasReadAccess(false);
            setError('Access denied: you do not have access to this document');
          }
        } else {
          setHasEditAccess(false);
          setHasReadAccess(false);
          setError('Access denied: access list not found');
        }
      } catch (err) {
        setHasEditAccess(false);
        setHasReadAccess(false);
        setError('Error retrieving access list');
      }
    }
    checkAccess();
  }, [document, userEmail, userId, isOffline, checkConnectivity]);

  // -------- Share functionality --------
  // handleShareButtonClick removed as it was unused and implemented inline

  const handleShareSubmit = async () => {
    // Prevent non-owners from submitting share
    if (!isOwner) {
      setShareError("You do not have the right to share this document");
      return;
    }
    if (!document) return;
    const ok = await checkConnectivity();
    if (!ok) {
      setShareError("Connection required to share the note.");
      return;
    }
    if (!shareEmail || shareEmail.trim().length === 0) {
      setShareError("Email required");
      return;
    }

    setShareLoading(true);
    setShareError(null);
    setShareSuccess(null);

    // Do not share in offline mode
    if (isOffline || !navigator.onLine) {
      setShareError("Connection required to share the note.");
      setShareLoading(false);
      return;
    }

    try {
      const onlineOk = await checkConnectivity();
      if (!onlineOk) {
        setShareError("Connection required to share the note.");
        setShareLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("documentId", String(document.id));
      formData.append("email", shareEmail.trim());
      formData.append("permission", permission === "write" ? "true" : "false");

      const res = await addShareAction(undefined, formData);

      if (typeof res === "object" && res.success) {
        setShareSuccess(res.message || "Share registered.");
        setIsShareModalOpen(false);
        router.refresh();
      } else {
        setShareError(typeof res === "string" ? res : (res.error || "Error during sharing."));
      }
    } catch (err) {
      console.error(err);
      setShareError("Error during sharing.");
    } finally {
      setShareLoading(false);
    }
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  // -------- Conditional rendering (after all Hooks) --------
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
            Access denied
          </h1>
          <p className="text-muted-foreground mb-6">
            You must be logged in to modify a document.
          </p>
          <Link
            href="/login"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
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
          <p className="text-foreground mb-6">{error}</p>
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

  if (!document) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Document not found
          </h1>
          <p className="text-muted-foreground mb-6">
            This document does not exist or has been deleted.
          </p>
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

  // Check if user has any access (read or edit)
  if (hasReadAccess === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Access denied
          </h1>
          <p className="text-muted-foreground mb-6">
            You are not authorized to access this document.
          </p>
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

  const renderSaveStatusMarker = () => {
    if (saveStatus === "saving") {
      return (
        <span
          className="inline-flex h-6 w-6 items-center justify-center"
          aria-hidden="true"
        >
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-[var(--card)]" />
        </span>
      );
    }

    if (saveStatus === "unsynchronized") {
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center" aria-hidden="true">
          <Icon name="circleX" className="h-5 w-5 text-[var(--destructive)]" />
        </span>
      );
    }

    return (
      <span className="inline-flex h-6 w-6 items-center justify-center" aria-hidden="true">
        <Icon name="check" className="h-4 w-4 text-[var(--success)]" />
      </span>
    );
  };

  const saveStatusLabel = getSaveStatusLabel(saveStatus);

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
          <div className="flex flex-row items-center gap-4">
            {hasEditAccess !== false && (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]"
                aria-live="polite"
                title={saveStatusLabel}
              >
                {renderSaveStatusMarker()}
              </div>
            )}
            <UserListButton users={users} className="self-center" documentId={document.id} onAccessListRefresh={loadAccessList} isOwner={isOwner} currentUserId={userId} />
            {hasEditAccess === false && (
              <div className="px-3 py-1 bg-[var(--muted)] text-foreground text-sm font-medium rounded-full border border-[var(--border)]">
                Read-only mode
              </div>
            )}
            <div className="relative inline-block">
              <Button
                variant="ghostPurple"
                size="icon"
                onClick={toggleMenu}
                className="md:mr-0"
              >
                <Icon name="dotsVertical" className="h-6 w-6" />
              </Button>
              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onMouseDown={() => setIsMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-full z-40 rounded-lg shadow-lg p-4 min-w-[13rem] bg-background border border-border">
                    <MenuItem
                      onClick={() => {
                        if (hasEditAccess !== false) {
                          setIsMenuOpen(false);
                          setShareError(null);
                          setShareSuccess(null);
                          setIsShareModalOpen(true);
                          (async () => {
                            const ok = await checkConnectivity();
                            if (!ok) {
                              setShareError("Connection required to share the note.");
                            }
                          })();
                        }
                      }}
                      disabled={hasEditAccess === false}
                      icon={<Icon name="share" className={hasEditAccess === false ? "w-4 h-4 text-muted-foreground" : "w-4 h-4 text-primary"} />}
                      >
                      {hasEditAccess === false ? "Read-only" : "Share"}
                    </MenuItem>

                    <MenuItem
                      onClick={() => {
                        setIsHistoryOpen(true);
                        setIsMenuOpen(false);
                      }}
                      icon={<Icon name="clock" className="w-4 h-4 text-primary" />}
                    >
                      History
                    </MenuItem>

                    <MenuItem
                      onClick={() => {
                        if (hasEditAccess !== false) {
                          handleSubmit();
                          setIsMenuOpen(false);
                        }
                      }}
                      disabled={hasEditAccess === false || isManualSaving}
                      icon={<Icon name="save" className={hasEditAccess === false || isManualSaving ? "w-4 h-4 text-muted-foreground" : "w-4 h-4 text-primary"} />}
                    >
                      {isManualSaving ? "Saving..." : hasEditAccess === false ? "Read-only" : "Save"}
                    </MenuItem>

                    <MenuItem
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsExportOpen(true);
                      }}
                      icon={<Icon name="export" className="w-4 h-4 text-primary" />}
                    >
                      Export
                    </MenuItem>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Share Modal */}
        <Modal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title="Share note"
          size="md"
          className="flex flex-col justify-center"
        >
          <Modal.Content>
            {isOwner ? (
              <div className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  id="email"
                  name="email"
                  required
                  placeholder="email@email.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                />

                <div>
                  <label className="text-sm font-medium text-foreground mb-1">
                    Permissions
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {permission === "write" ? "Can edit" : "Can read"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => setPermission("read")}
                        className={permission === "read" ? "bg-muted" : ""}
                      >
                        Can read
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setPermission("write")}
                        className={permission === "write" ? "bg-muted" : ""}
                      >
                        Can edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="primary"
                    size="default"
                    onClick={handleShareSubmit}
                    disabled={shareLoading}
                  >
                    {shareLoading ? "Sending..." : "Send"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShareEmail("");
                      setShareError(null);
                      setIsShareModalOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                {shareError && (
                  <p className="text-sm text-destructive mt-2">{shareError}</p>
                )}
                {shareSuccess && (
                  <p className="text-sm text-primary mt-2">{shareSuccess}</p>
                )}
              </div>
            ) : (
              <div className="py-1 text-center">
                <p className="text-lg font-medium text-foreground mb-4">You do not have permission to share this document</p>
                <div className="flex justify-center">
                  <Button variant="ghost" onClick={() => setIsShareModalOpen(false)}>Close</Button>
                </div>
              </div>
            )}
          </Modal.Content>
          <Modal.Footer>
          </Modal.Footer>
        </Modal>

        {/* New doc banner/cancel */}
        {isNew && hasEditAccess !== false && (
          <div className="mb-4 rounded-lg p-3 bg-muted flex items-center justify-between">
            <span className="text-sm text-muted-foreground">New note being created</span>
            <Button variant="ghost" onClick={handleCancelCreation}>Cancel creation</Button>
          </div>
        )}

        {/* Edit form */}
        <div className="bg-card rounded-2xl border border-border p-6 overflow-hidden">
          <form className="space-y-6">
            {/* Tags */}
            <div className="mb-1">
              <TagsManager
                tags={tags}
                onTagsChange={handleTagsChange}
                placeholder="Add a tag..."
                maxTags={20}
                className="w-full"
                disabled={hasEditAccess === false}
                currentUserId={userId}
                requireAuth={true}
              />
            </div>

            {/* Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={hasEditAccess === false ? undefined : (e) => {
                  const newTitle = e.target.value;
                  setTitle(newTitle);
                  if (emitTitleChange && isTitleConnected) {
                    emitTitleChange(newTitle);
                  }
                  flushTitleRealtime(newTitle);
                  triggerAutoSave();
                }}
                readOnly={hasEditAccess === false}
                className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-transparent text-foreground text-xl font-semibold ${hasEditAccess === false ? 'cursor-default opacity-75' : ''}`}
                placeholder="Document title"
                maxLength={255}
              />
            </div>

            {/* Content */}
            <div>
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <WysiwygNotepad
                  key={`doc-${document.id}`}
                  initialData={content}
                  onContentChange={handleContentChange}
                  onRemoteContentChange={(remoteContent) => {
                    // Keep React state in sync so autosave submits the latest content
                    setContent(remoteContent);
                    // Persist to localStorage like local edits do
                    updateLocalStorage(remoteContent);
                    // Update refs because it's a remote change (synchronized)
                    const contentString = JSON.stringify(remoteContent);
                    lastSavedContentRef.current = contentString;
                    setSaveStatus('synchronized');
                  }}
                  placeholder="Start writing your document..."
                  className=""
                  showDebug={false}
                  readOnly={hasEditAccess === false}
                  roomId={String(document.id)}
                  documentId={String(document.id)}
                  userId={realtimeUserId}
                  userEmail={userEmail || props.session?.user?.email || undefined}
                  title={title}
                  tags={tags}
                  getContentSnapshot={buildContentSnapshot}
                  onSyncStatusChange={handleSyncStatusChange}
                  onPersisted={handleRealtimePersisted}
                  onRegisterFlush={handleRegisterFlush}
                  onRealtimeConnectionChange={handleRealtimeConnectionChange}
                  onOpenSynthesis={() => {
                    setIsSynthesisOpen(true);
                    setIsCommentsOpen(false);
                    setIsHistoryOpen(false);
                  }}
                />
              </div>
            </div>


          </form>
        </div>

        {/* Export overlay (client-only) */}
        <ExportOverlay
          open={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          markdown={content.text || ""}
        />

        {/* Saved notification */}
        {showSavedNotification && (
          <div className="fixed bottom-4 left-4 z-50 pointer-events-none">
            <div className="bg-primary text-primary-foreground border border-primary rounded-lg px-3 py-2 shadow-lg pointer-events-auto flex items-center">
              <Icon name="check" className="w-4 h-4 mr-2 text-primary-foreground" />
              <span className="text-sm font-medium">Note saved</span>
            </div>
          </div>
        )}
      </div>
      <CommentsSidebar
        documentId={document?.id ?? null}
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
      />
      <HistorySidebar
        documentId={document?.id ?? null}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
      <SynthesisSidebar
        documentId={document?.id ?? null}
        isOpen={isSynthesisOpen}
        onClose={() => setIsSynthesisOpen(false)}
        documentContent={content?.text || ""}
      />
      {/* Floating button for comments */}
      <button
        onClick={() => {
          setIsCommentsOpen((open) => !open);
          setIsHistoryOpen(false);
          setIsSynthesisOpen(false);
        }}
        disabled={!document?.id}
        title="Show comments"
        className={cn(
          "fixed bottom-6 right-6 z-40 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg flex items-center justify-center",
          "hover:bg-[var(--primary)]/90 active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "w-14 h-14 md:w-16 md:h-16",
          "transition-all duration-300 ease-in-out",
          isCommentsOpen
            ? "scale-0 opacity-0 pointer-events-none"
            : "scale-100 opacity-100 pointer-events-auto"
        )}
      >
        <Icon name="comment" className="w-6 h-6 md:w-7 md:h-7" />
      </button>
    </div>
  );
}