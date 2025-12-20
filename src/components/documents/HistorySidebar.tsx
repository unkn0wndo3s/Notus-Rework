"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, ScrollArea } from "@/components/ui";
import Icon from "@/components/Icon";
import { useLocalSession } from "@/hooks/useLocalSession";
import { cn } from "@/lib/utils";
import { MarkdownConverter } from "@/components/Paper.js/Editor/MarkdownConverter";
import { sanitizeHtml, EDITOR_SANITIZE_CONFIG } from "@/lib/sanitizeHtml";
import { getDocumentHistoryAction } from "@/actions/documentActions";

interface HistoryUser {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  profile_image?: string | null;
}

interface HistoryItem {
  id: number;
  created_at: string;
  diff_added?: string | null;
  diff_removed?: string | null;
  user: HistoryUser | null;
}

interface HistorySidebarProps {
  documentId: number | null | undefined;
  isOpen: boolean;
  onClose: () => void;
}

function getUserInitials(user: HistoryUser | null): string {
  if (!user) return "?";
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  const first = user.first_name || user.email || "";
  const last = user.last_name || "";
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  const initials = `${a}${b}`.trim();
  return initials || "?";
}

function getUserDisplayName(user: HistoryUser | null): string {
  if (!user) return "Unknown user";
  if (user.username) return user.username;
  if (user.first_name || user.last_name) {
    return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  }
  if (user.email) return user.email;
  return "User";
}

function formatDateHeader(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const historyDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (historyDate.getTime() === today.getTime()) {
    return "Today";
  } else if (historyDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateKey(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface GroupedHistoryItem extends HistoryItem {
  groupedIds: number[];
}

function groupHistoryEntries(entries: HistoryItem[]): GroupedHistoryItem[] {
  if (entries.length === 0) return [];

  const grouped: GroupedHistoryItem[] = [];
  const GROUPING_WINDOW_MS = 60000; // 1 minute to group modifications

  for (const entry of entries) {
    const entryDate = new Date(entry.created_at);
    const entryUserId = entry.user?.id ?? null;

    // Search for an existing group to which this entry can be added
    let foundGroup = false;
    for (let i = 0; i < grouped.length; i++) {
      const group = grouped[i];
      const groupDate = new Date(group.created_at);
      const groupUserId = group.user?.id ?? null;

      // Check if entry belongs to this group (same user and close timestamp)
      const timeDiff = Math.abs(entryDate.getTime() - groupDate.getTime());
      const sameUser = entryUserId === groupUserId;

      if (sameUser && timeDiff <= GROUPING_WINDOW_MS) {
        // Merge diffs
        const existingAdded = group.diff_added || "";
        const existingRemoved = group.diff_removed || "";
        const newAdded = entry.diff_added || "";
        const newRemoved = entry.diff_removed || "";

        group.diff_added = (existingAdded + newAdded).trim() || null;
        group.diff_removed = (existingRemoved + newRemoved).trim() || null;
        group.groupedIds.push(entry.id);
        // Keep the oldest timestamp of the group (first modification)
        if (entryDate.getTime() < groupDate.getTime()) {
          group.created_at = entry.created_at;
        }
        foundGroup = true;
        break;
      }
    }

    // If no group found, create a new one
    if (!foundGroup) {
      grouped.push({
        ...entry,
        groupedIds: [entry.id],
      });
    }
  }

  return grouped;
}

// Component to display content in HTML + MD preview
function HistoryContentPreview({ content, isRemoved }: Readonly<{ content: string; isRemoved?: boolean }>) {
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const markdownConverterRef = useRef<MarkdownConverter | null>(null);

  useEffect(() => {
    if (!markdownConverterRef.current) {
      markdownConverterRef.current = new MarkdownConverter();
    }

    const convertContent = async () => {
      if (!content || !content.trim()) {
        setHtmlContent("");
        setIsLoading(false);
        return;
      }

      try {
        // Check if content is already HTML (simple detection)
        const trimmed = content.trim();
        const isHtml = trimmed.startsWith("<") && (trimmed.includes("</") || trimmed.endsWith("/>") || trimmed.endsWith(">"));
        
        let html: string;
        if (isHtml) {
          // If already HTML, sanitize directly
          html = sanitizeHtml(trimmed, EDITOR_SANITIZE_CONFIG);
        } else {
          // Otherwise convert markdown to HTML
          if (markdownConverterRef.current) {
            html = await markdownConverterRef.current.markdownToHtml(content);
          } else {
            html = sanitizeHtml(content, EDITOR_SANITIZE_CONFIG);
          }
        }
        
        setHtmlContent(html);
      } catch (error) {
        console.error("Error converting content:", error);
        // On error, show raw sanitized content
        setHtmlContent(sanitizeHtml(content, EDITOR_SANITIZE_CONFIG));
      } finally {
        setIsLoading(false);
      }
    };

    void convertContent();
  }, [content]);

  if (isLoading) {
    return <span className="text-muted-foreground text-xs">Loading...</span>;
  }

  if (!htmlContent) {
    return null;
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none break-words text-foreground/90",
        isRemoved && "[&_*]:line-through [&_*]:decoration-rose-500/60"
      )}
      style={isRemoved ? { textDecoration: "line-through", textDecorationColor: "rgb(244 63 94 / 0.6)" } : undefined}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

export default function HistorySidebar({ documentId, isOpen, onClose }: Readonly<HistorySidebarProps>) {
  const [entries, setEntries] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { userId } = useLocalSession();

// ...

  const fetchHistory = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getDocumentHistoryAction(documentId);
      
      if (!result.success) {
        setError(result.error || "Unable to load history");
        setEntries([]);
        return;
      }
      const raw = Array.isArray(result.history) ? result.history : [];
      const normalized: HistoryItem[] = raw.map((item: any) => ({
        id: item.id,
        created_at: item.created_at,
        diff_added: item.diff_added ?? null,
        diff_removed: item.diff_removed ?? null,
        user: item.user ?? null,
      }));
      setEntries(normalized);
    } catch (e) {
      setError("Error loading history");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen && documentId) {
      void fetchHistory();
    }
  }, [isOpen, documentId, fetchHistory]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [entries, isOpen]);

  // Prevent body scroll on mobile when sidebar is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflowX = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
        document.documentElement.style.overflowX = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 bottom-0 left-0 right-0 md:left-auto md:right-0 z-50 md:w-full md:max-w-md bg-background md:border-l border-border shadow-xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="clock" className="w-5 h-5" />
          <h2 className="text-xl font-title">Note History</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <Icon name="x" className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 pt-3 pb-1 text-xs text-muted-foreground">
          {loading && <span>Loading history…</span>}
          {!loading && !error && entries.length === 0 && (
            <span>No modifications recorded yet.</span>
          )}
          {!loading && error && (
            <span className="text-red-500">{error}</span>
          )}
        </div>
        <ScrollArea className="flex-1 px-2 pb-2 max-h-full overflow-hidden">
          <div className="space-y-3 px-2">
            {(() => {
              const groupedEntries = groupHistoryEntries(entries);
              return groupedEntries.map((entry, index) => {
                const user = entry.user ?? null;
                const isCurrentUser =
                  userId && user?.id && String(userId) === String(user.id);
                const entryDate = new Date(entry.created_at);
                const previousDate =
                  index > 0 ? new Date(groupedEntries[index - 1].created_at) : null;
                const showDateHeader =
                  !previousDate ||
                  getDateKey(entryDate) !== getDateKey(previousDate);

              const hasAdded = !!entry.diff_added && entry.diff_added.trim().length > 0;
              const hasRemoved = !!entry.diff_removed && entry.diff_removed.trim().length > 0;

              return (
                <div key={entry.groupedIds[0] || entry.id} className="space-y-1">
                  {showDateHeader && (
                    <div className="flex items-center justify-center py-2">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {formatDateHeader(entryDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 px-1">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-muted/40 w-fit">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            {user?.profile_image ? (
                              <AvatarImage
                                src={user.profile_image}
                                alt={getUserDisplayName(user)}
                              />
                            ) : (
                              <AvatarFallback className="bg-muted text-xs">
                                {getUserInitials(user)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <span className="text-xs font-semibold break-words text-foreground min-w-0">
                            {getUserDisplayName(user)}
                          </span>
                          <span className="text-[9px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                          {formatTime(entryDate)}
                        </span>
                        </div>
                      </div>
                      {(hasAdded || hasRemoved) && (
                        <div className="space-y-1 text-xs">
                          {hasAdded && (
                            <div className="border-l-2 border-emerald-500 pl-2 w-full">
                              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 mb-0.5">
                                <Icon name="plus" className="w-3 h-3 flex-shrink-0" />
                                <span className="font-medium">Additions</span>
                              </div>
                              <HistoryContentPreview content={entry.diff_added || ""} />
                            </div>
                          )}
                          {hasRemoved && (
                            <div className="border-l-2 border-rose-500 pl-2 w-full">
                              <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 mb-0.5">
                                <Icon name="minus" className="w-3 h-3 flex-shrink-0" />
                                <span className="font-medium">Deletions</span>
                              </div>
                              <HistoryContentPreview content={entry.diff_removed || ""} isRemoved />
                            </div>
                          )}
                        </div>
                      )}
                      {!hasAdded && !hasRemoved && (
                        <div className="px-3">
                          <p className="text-muted-foreground text-[11px]">
                            No textual differences detected for this edit.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
              });
            })()}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
