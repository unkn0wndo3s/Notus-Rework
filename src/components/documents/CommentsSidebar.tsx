"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, Textarea, ScrollArea } from "@/components/ui";
import Icon from "@/components/Icon";
import { useLocalSession } from "@/hooks/useLocalSession";
import { cn } from "@/lib/utils";

interface CommentUser {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  profile_image?: string | null;
}

interface CommentItem {
  id: number;
  content: string;
  created_at: string;
  user: CommentUser | null;
}

interface CommentsSidebarProps {
  documentId: number | null | undefined;
  isOpen: boolean;
  onClose: () => void;
}

const MAX_COMMENT_LENGTH = 500;

function getUserInitials(user: CommentUser | null): string {
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

function getUserDisplayName(user: CommentUser | null): string {
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
  const commentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (commentDate.getTime() === today.getTime()) {
    return "Today";
  } else if (commentDate.getTime() === yesterday.getTime()) {
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

import { getComments, createComment } from "@/actions/commentActions";

export default function CommentsSidebar({ documentId, isOpen, onClose }: Readonly<CommentsSidebarProps>) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { userId } = useLocalSession();

  const fetchComments = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getComments(documentId);
      if (result.success) {
        setComments((result.comments as unknown as CommentItem[]) || []);
      } else {
        setError(result.error || "Unable to load comments");
        setComments([]);
      }
    } catch (e) {
      setError("Error loading comments");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen && documentId) {
      void fetchComments();
    }
  }, [isOpen, documentId, fetchComments]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [comments, isOpen]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) return;
    const content = newComment.trim();
    if (!content) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await createComment(documentId, content);
      if (result.success) {
        setNewComment("");
        if (result.comment) {
          setComments((prev) => [...prev, result.comment as unknown as CommentItem]);
        } else {
          void fetchComments();
        }
      } else {
        setError(result.error || "Unable to send comment");
      }
    } catch (e) {
      setError("Error sending comment");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 bottom-0 left-0 right-0 md:left-auto md:right-0 z-50 md:w-full md:max-w-md bg-background md:border-l border-border shadow-xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="comment" className="w-5 h-5" />
          <h2 className="text-xl font-title">Note Comments</h2>
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
          {loading && <span>Loading comments…</span>}
          {!loading && !error && comments.length === 0 && (
            <span>No comments yet. Be the first to comment.</span>
          )}
          {!loading && error && (
            <span className="text-red-500">{error}</span>
          )}
        </div>
        <ScrollArea className="flex-1 px-2 pb-2 max-h-full overflow-hidden">
          <div className="space-y-3 px-2">
            {comments.map((comment, index) => {
              const user = comment.user ?? null;
              const isCurrentUser = userId && user?.id && String(userId) === String(user.id);
              const commentDate = new Date(comment.created_at);
              const previousCommentDate = index > 0 ? new Date(comments[index - 1].created_at) : null;
              const showDateHeader = !previousCommentDate || getDateKey(commentDate) !== getDateKey(previousCommentDate);

              return (
                <div key={comment.id} className="space-y-1">
                  {showDateHeader && (
                    <div className="flex items-center justify-center py-2">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {formatDateHeader(commentDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex flex-col items-center gap-1 min-w-[60px]">
                      <span className={cn(
                        "text-[9px] text-muted-foreground",
                        isCurrentUser ? "text-right" : "text-left"
                      )}>
                        {formatTime(commentDate)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-lg px-3 py-2 w-fit max-w-[85%] overflow-hidden",
                        isCurrentUser
                          ? "flex-row-reverse bg-[var(--primary)]/75 ml-auto"
                          : "bg-muted/40"
                      )}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        {user?.profile_image ? (
                          <AvatarImage src={user.profile_image} alt={getUserDisplayName(user)} />
                        ) : (
                          <AvatarFallback className="bg-muted">
                            <Icon name="user" className="h-5 w-5 text-primary" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className={cn(
                        "min-w-0 max-w-full overflow-hidden",
                        isCurrentUser ? "text-right" : ""
                      )}>
                        <div className={cn(
                          "flex items-center gap-2",
                          isCurrentUser ? "flex-row-reverse justify-start" : "justify-start"
                        )}>
                          <span className={cn(
                            "text-xs font-semibold break-words",
                            isCurrentUser
                              ? "text-[var(--primary-foreground)]"
                              : "text-foreground"
                          )}>
                            {getUserDisplayName(user)}
                          </span>
                        </div>
                        <p className={cn(
                          "mt-1 text-xs whitespace-pre-wrap break-words",
                          isCurrentUser
                            ? "text-[var(--primary-foreground)]"
                            : "text-foreground"
                        )}>
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border px-3 py-2 space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= MAX_COMMENT_LENGTH) {
              setNewComment(value);
            }
          }}
          placeholder="Write a comment…"
          rows={2}
          className="text-sm resize-none"
          maxLength={MAX_COMMENT_LENGTH}
        />
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "text-[10px]",
            newComment.length >= MAX_COMMENT_LENGTH
              ? "text-destructive"
              : "text-muted-foreground"
          )}>
            {newComment.length}/{MAX_COMMENT_LENGTH} characters
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={submitting || !newComment.trim() || !documentId || newComment.length > MAX_COMMENT_LENGTH}
            className="px-4 py-2"
            variant="default"
          >
            {submitting ? "Sending..." : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
