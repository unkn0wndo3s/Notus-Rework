"use client";
import { useState, useEffect, useRef } from "react";
import { useActionState, startTransition } from "react";
import { deleteDocumentAction, updateDocumentAction, toggleFavoriteAction } from "@/lib/actions";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";
import Modal from "@/components/ui/modal";
import TagsManager from "@/components/documents/TagsManager";
import LoginRequiredModal from "@/components/auth/LoginRequiredModal";
import { cn } from "@/lib/utils";
import { Document, LocalDocument, AnyDocument } from "@/lib/types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import FavoriteToggle from "@/components/documents/FavoriteToggle";
import sanitizeLinks from "@/lib/sanitizeLinks";
import { sanitizeHtml, PREVIEW_SANITIZE_CONFIG } from "@/lib/sanitizeHtml";
import Icon from "@/components/Icon";

interface DocumentCardProps {
  document: AnyDocument;
  currentUserId?: string | number | null;
  onDelete?: (id: string | number) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string | number, checked: boolean) => void;
  onEnterSelectMode?: (id: string | number) => void;
  isLocal?: boolean;
  index?: number;
  onFavoriteChange?: (id: string | number, isFavorite: boolean) => void;
}

function unwrapToString(raw: any): string {
  try {
    let cur = raw;
    let safety = 0;
    while (safety < 50) {
      safety++;
      if (typeof cur === "string") {
        try {
          const parsed = JSON.parse(cur);
          cur = parsed;
          continue;
        } catch (e) {
          return stripHtml(cur);
        }
      }
      if (cur && typeof cur === "object" && "text" in cur) {
        cur = (cur as any).text;
        continue;
      }
      if (cur && typeof cur === "object") {
        for (const k of Object.keys(cur)) {
          if (typeof (cur as any)[k] === "string") return stripHtml((cur as any)[k]);
          if (
            (cur as any)[k] &&
            typeof (cur as any)[k] === "object" &&
            "text" in (cur as any)[k] &&
            typeof (cur as any)[k].text === "string"
          ) {
            return stripHtml((cur as any)[k].text);
          }
        }
        return JSON.stringify(cur);
      }
      return String(cur ?? "");
    }
    return String(raw ?? "");
  } catch (e) {
    return String(raw ?? "");
  }
}

function detectHtmlInString(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  try {
    const doc = new DOMParser().parseFromString(str, "text/html");
    return Array.from(doc.body.childNodes).some((n) => n.nodeType === 1);
  } catch (e) {
    return /<\/?[a-z][\s\S]*>/i.test(str);
  }
}

function stripHtml(str: string): string {
  if (!str || typeof str !== "string") return "";
  return str.replace(/<\/?[^>]+(>|$)/g, "");
}

export default function DocumentCard({
  document,
  currentUserId,
  onDelete,
  selectMode = false,
  selected = false,
  onToggleSelect = () => {},
  onEnterSelectMode = () => {},
  isLocal = false,
  index = 0,
  onFavoriteChange,
}: DocumentCardProps) {
  const [message, formAction, isPending] = useActionState(
    deleteDocumentAction,
    undefined
  );
  const [updateMsg, updateFormAction, isUpdating] = useActionState(
    updateDocumentAction,
    { ok: false, error: "" }
  );
  const [favMsg, favFormAction, isFavUpdating] = useActionState(
    toggleFavoriteAction,
    undefined
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { checkConnectivity } = useGuardedNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const isOwner = ('user_id' in document) ? (document as any).user_id === currentUserId : false;
  const updatedDate = new Date((document as any).updated_at || new Date());
  const [accessList, setAccessList] = useState<any[]>([]);
  // Normalize is_favorite which can come from different sources (document.is_favorite or Share.is_favorite)
  // and may be truthy but not strictly `true` in some codepaths. Keep local state
  // synchronized when the prop changes.
  const [isFavorite, setIsFavorite] = useState<boolean>(Boolean((document as any).is_favorite));
  useEffect(() => {
    try {
      setIsFavorite(Boolean((document as any).is_favorite));
    } catch (e) {
      // ignore
    }
  }, [(document as any).is_favorite]);
  const formattedDate = updatedDate.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
  const updatedAtIso = (
    typeof (document as any).updated_at === 'string'
      ? (document as any).updated_at
      : new Date((document as any).updated_at || Date.now()).toISOString()
  );

  const getContentText = (content: any): string => {
    try {
      if (typeof content === "string") {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object" && "text" in parsed) { return parsed.text || ""; }
        return content;
      }
      if (typeof content === "object" && content !== null) { return (content as any).text || ""; }
      return content || "";
    } catch (e) { return content || ""; }
  };
  const contentText = getContentText((document as any).content);
  const contentTextSanitized = sanitizeLinks(contentText);
  const cleanText = (text: string): string => text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/<u>(.*?)<\/u>/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/<span[^>]*>(.*?)<\/span>/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .trim();
  const firstLine = cleanText((contentTextSanitized || "").substring(0, 500).split(/\n\n/)[0]);
  const isEmpty = !contentText || contentText.trim() === "" || !firstLine || firstLine.trim() === "";
  const rawPreviewSource = sanitizeLinks(getContentText((document as any)?.content));
  const normalizedString = unwrapToString(rawPreviewSource);
  const contentIsHtml = detectHtmlInString(normalizedString);
  const previewText = contentIsHtml ? stripHtml(normalizedString) : normalizedString;
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    if (!contentIsHtml) {
      setPreviewHtml("");
      return;
    }
    try {
      const safe = sanitizeHtml(normalizedString, PREVIEW_SANITIZE_CONFIG);
      setPreviewHtml(safe);
    } catch (e) {
      console.warn("DOMPurify sanitize failed", e);
      setPreviewHtml(stripHtml((document as any)?.content || ""));
    }
  }, [(document as any)?.content, contentIsHtml, normalizedString]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/openDoc/accessList?id=${(document as any).id}`);
        const data = await res.json();
        const list = data?.accessList || [];
        if (data?.success && mounted) setAccessList(list);
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, [(document as any).id]);

  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    if (Array.isArray((document as any).tags)) { setTags((document as any).tags); return; }
    try {
      const raw = localStorage.getItem("notus.tags");
      const parsed = raw ? JSON.parse(raw) : {};
      const existing = parsed?.[String((document as any).id)] || [];
      if (Array.isArray(existing)) setTags(existing);
    } catch (_) {}
  }, [(document as any).id, (document as any).tags]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("notus.tags");
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[String((document as any).id)] = tags;
      localStorage.setItem("notus.tags", JSON.stringify(parsed));
    } catch (_) {}
  }, [tags, (document as any).id]);

  const persistTags = (nextTags: string[]) => {
    if (!currentUserId) return;
    const fd = new FormData();
    fd.append("documentId", String((document as any).id));
    fd.append("userId", String(currentUserId));
    fd.append("title", (document as any).title || "Untitled");
    fd.append("content", (document as any).content || "");
    fd.append("tags", JSON.stringify(nextTags));
    startTransition(() => { updateFormAction(fd); });
  };

  const handleTagsChange = async (newTags: string[]) => {
    const prevTags = tags || [];
    const isAddition = newTags.length > prevTags.length;
    const isRemoval = newTags.length < prevTags.length;
    if (isAddition) {
      if (!currentUserId) {
        window.dispatchEvent(new CustomEvent("notus:offline-popin", { detail: { message: "You will be able to access this feature once connectivity is restored.", durationMs: 5000 } }));
        return;
      }
      const online = await checkConnectivity();
      if (!online) {
        window.dispatchEvent(new CustomEvent("notus:offline-popin", { detail: { message: "You will be able to access this feature once connectivity is restored.", durationMs: 5000 } }));
        return;
      }
      setTags(newTags);
      persistTags(newTags);
      return;
    }
    if (isRemoval) {
      setTags(newTags);
      if (!currentUserId) return;
      const online = await checkConnectivity();
      if (online) { persistTags(newTags); }
      else { window.dispatchEvent(new CustomEvent("notus:offline-popin", { detail: { message: "You will be able to access this feature once connectivity is restored.", durationMs: 5000 } })); }
      return;
    }
  };

  const handleTagsClick = () => { if (!currentUserId) { setShowLoginModal(true); } };

  const handleDelete = (formData: FormData) => {
    if (!currentUserId) return;
    formData.append("documentId", String((document as any).id));
    formData.append("userId", String(currentUserId));
    startTransition(() => { formAction(formData); });
    setShowDeleteConfirm(false);
    if (onDelete) { onDelete((document as any).id); }
  };

  const applyFavoriteChange = async (next: boolean) => {
    if (!currentUserId) { setShowLoginModal(true); return; }
    try {
      const fd = new FormData();
      fd.append("documentId", String((document as any).id));
      fd.append("value", next ? "1" : "");
      startTransition(() => { favFormAction(fd); });
      setIsFavorite(next);
      try { onFavoriteChange && onFavoriteChange((document as any).id, next); } catch (_) {}
    } catch (_) {}
  };

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressActivatedRef = useRef(false);
  const clearLongPressTimer = () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };
  const startLongPressTimer = () => {
    if (selectMode) {
      clearLongPressTimer();
      return;
    }
    clearLongPressTimer();
    longPressActivatedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressActivatedRef.current = true;
      onEnterSelectMode((document as any).id);
      onToggleSelect((document as any).id, true);
    }, 500);
  };
  const handleLongPress = () => {
    if (selectMode || longPressActivatedRef.current) return;
    onEnterSelectMode((document as any).id);
    onToggleSelect((document as any).id, !selected);
  };

  const previewRef = useRef<HTMLDivElement>(null);
  const [computedStyle, setComputedStyle] = useState({ color: null as string | null, backgroundColor: null as string | null, fontSize: null as string | null, fontFamily: null as string | null, fontWeight: null as string | null, lineHeight: null as string | null, accent: null as string | null });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = previewRef.current;
    const target = el instanceof Element ? el : ((window as any).document as any).body;
    try {
      const style = window.getComputedStyle(target);
      setComputedStyle({ color: style.color, backgroundColor: style.backgroundColor, fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, lineHeight: style.lineHeight, accent: style.getPropertyValue("--accent-color") || null, });
    } catch (e) { setComputedStyle((s) => s); }
  }, [previewHtml, previewText]);

  const documentUrl = isLocal ? `/documents/local/${encodeURIComponent(String((document as any).id))}` : `/documents/${(document as any).id}`;
  const handleCardNavigation = async (e: React.MouseEvent) => {
    if (showLoginModal) { e.preventDefault(); e.stopPropagation(); return; }
    if (longPressActivatedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressActivatedRef.current = false;
      return;
    }
    if (selectMode) { e.preventDefault(); e.stopPropagation(); onToggleSelect((document as any).id, !selected); return; }
    e.preventDefault();
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      const resp = await fetch("/api/admin/check-status", { method: "GET", cache: "no-store", credentials: "include", headers: { "cache-control": "no-cache" }, signal: controller.signal });
      window.clearTimeout(timeoutId);
      if (resp.ok) { window.location.href = documentUrl; }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent("notus:offline-popin", { detail: { message: "You will be able to access this feature once connectivity is restored.", durationMs: 5000 } }));
    }
  };

  return (
    <article
      className={cn(
        "group relative bg-card border rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 animate-fade-in-up cursor-pointer",
        selected && "border-primary ring-2 ring-primary/20 bg-primary/5",
      )}
      style={{ animationDelay: `${index * 50}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); clearLongPressTimer(); }}
      onContextMenu={(e) => { e.preventDefault(); handleLongPress(); }}
      onMouseDown={startLongPressTimer}
      onMouseUp={clearLongPressTimer}
      onTouchStart={startLongPressTimer}
      onTouchEnd={clearLongPressTimer}
      onClick={handleCardNavigation}
    >
      <header className="relative flex items-start justify-between mb-3 min-h-[2.5rem]">
        <div className="absolute inset-0 left-0 right-12 flex items-center gap-2 pointer-events-none">
          <div 
            className="flex-1 min-w-0 max-w-full pointer-events-auto" 
            onClick={(e) => { if (selectMode) { return; } e.preventDefault(); e.stopPropagation(); handleTagsClick(); }}
            onMouseDown={(e) => { e.stopPropagation(); }}
            onMouseUp={(e) => { e.stopPropagation(); }}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onTouchEnd={(e) => { e.stopPropagation(); }}
            onWheel={(e) => { e.stopPropagation(); }}
          >
            <TagsManager tags={tags} onTagsChange={handleTagsChange} placeholder="New tag..." maxTags={10} disabled={!currentUserId || selectMode} />
          </div>
        </div>
        {!selectMode && (
          <div className="relative z-10 ml-auto">
            <FavoriteToggle isFavorite={isFavorite} isAuthenticated={Boolean(currentUserId)} onToggleAuthenticated={applyFavoriteChange} onRequireLogin={() => setShowLoginModal(true)} />
          </div>
        )}
      </header>
      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-card-foreground group-hover:text-primary transition-colors duration-200">{(document as any).title}</h3>
        <div ref={previewRef} className="text-sm text-muted-foreground line-clamp-1 leading-relaxed">
          {contentIsHtml ? (
            previewHtml ? (
              <div className="prose max-w-full" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-muted-foreground/70 italic">Loading...</p>
            )
          ) : (
            !isEmpty ? (
              <p className="text-muted-foreground">{firstLine}</p>
            ) : (
              <p className="text-muted-foreground italic">Empty document</p>
            )
          )}
        </div>
      </section>
      <footer className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <time dateTime={updatedAtIso} className="text-xs text-muted-foreground">{formattedDate}</time>
        {currentUserId && !selectMode && (
          <div className="flex items-center ml-3">
            <div className="flex -space-x-2">
              {accessList.map((u, i) => (
                <div key={u.email || u.id || i} className="inline-block">
                  <Avatar title={u.username || (u.first_name ?? "")}>
                    <AvatarImage src={u.profile_image ?? undefined} alt={`${u.first_name ?? ""} ${u.last_name ?? ""}`} loading="lazy" />
                    <AvatarFallback className="text-xs">{((u.first_name || u.username || "U") as string).charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
              ))}
            </div>
          </div>
        )}
        {selectMode && (
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect((document as any).id, !selected); }} className={cn("h-5 w-5 border-2 rounded transition-all duration-200 cursor-pointer flex items-center justify-center animate-fade-in", selected ? "border-primary bg-primary" : "border-input bg-background")} role="checkbox" aria-checked={selected} aria-label="Select this document">
            {selected && (<Icon name="check" className="w-4 h-4 text-primary-foreground" />)}
          </div>
        )}
      </footer>
      {message && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"><p className="text-sm text-destructive">{message}</p></div>
      )}
      <LoginRequiredModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} message="You must be logged in to manage this document's tags." />
    </article>
  );
}


