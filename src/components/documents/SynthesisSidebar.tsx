"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, ScrollArea } from "@/components/ui";
import Icon from "@/components/Icon";
import { useLocalSession } from "@/hooks/useLocalSession";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface SynthesisUser {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  profile_image?: string | null;
}

interface SynthesisItem {
  id: number;
  content: string;
  created_at: string;
  user: SynthesisUser | null;
}

interface SynthesisSidebarProps {
  documentId: number | null | undefined;
  isOpen: boolean;
  onClose: () => void;
  documentContent?: string;
}

function getUserInitials(user: SynthesisUser | null): string {
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

function getUserDisplayName(user: SynthesisUser | null): string {
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
  const synthesisDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (synthesisDate.getTime() === today.getTime()) {
    return "Today";
  } else if (synthesisDate.getTime() === yesterday.getTime()) {
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

// Function to extract text without markdown formatting (identical to API)
function stripMarkdownFormatting(text: string): string {
  if (!text || typeof text !== "string") return "";
  
  return text
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    // Remove italics
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, "$1")
    // Remove markdown links
    .replace(/\[([^\]]*)\]\([^\)]*\)/g, "$1")
    // Remove markdown images
    .replace(/!\[([^\]]*)\]\([^\)]*\)/g, "")
    // Remove lists
    .replace(/^[\*\-\+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    // Remove blockquotes
    .replace(/^>\s+/gm, "")
    // Remove inline code
    .replace(/`([^`]*)`/g, "$1")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Clean multiple spaces
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Function to estimate tokens (identical to API)
function estimateTokens(content: string): number {
  if (!content || typeof content !== "string") return 0;
  
  const plainText = stripMarkdownFormatting(content);
  if (!plainText || plainText.trim().length === 0) return 0;
  
  // Estimation: 1 token ≈ 4 characters for the prompt
  const promptTokens = Math.ceil(plainText.length / 4);
  // Estimation for synthesis response
  const estimatedResponseTokens = 1000;
  
  return promptTokens + estimatedResponseTokens;
}

export default function SynthesisSidebar({ documentId, isOpen, onClose, documentContent }: Readonly<SynthesisSidebarProps>) {
  const [syntheses, setSyntheses] = useState<SynthesisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiSynthesisEnabled, setAiSynthesisEnabled] = useState(true);
  const [tokenUsage, setTokenUsage] = useState<{ limit: number; used: number; remaining: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { userId } = useLocalSession();

  // State for sidebar width with localStorage
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("synthesis-sidebar-width");
      return saved ? parseInt(saved, 10) : 448; // 448px = max-w-md (28rem)
    }
    return 448;
  });

  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Detect if on desktop
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Save width in localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("synthesis-sidebar-width", sidebarWidth.toString());
    }
  }, [sidebarWidth]);

  // Handle resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      
      const deltaX = resizeRef.current.startX - e.clientX; // Inverted because resizing from left
      const newWidth = Math.max(300, Math.min(800, resizeRef.current.startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    };
  };

  // Calculate token estimation for generation
  const estimatedTokens = documentContent ? estimateTokens(documentContent) : 0;

  const fetchSyntheses = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/syntheses?documentId=${documentId}`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Unable to load syntheses");
        setSyntheses([]);
        return;
      }
      setSyntheses(Array.isArray(data.syntheses) ? data.syntheses : []);
    } catch (e) {
      setError("Error loading syntheses");
      setSyntheses([]);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen && documentId) {
      void fetchSyntheses();
    }
  }, [isOpen, documentId, fetchSyntheses]);

  // Check if AI synthesis is enabled and load token usage
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [statusRes, tokensRes] = await Promise.all([
          fetch("/api/syntheses/status"),
          fetch("/api/syntheses/tokens"),
        ]);
        
        const statusData = await statusRes.json();
        if (statusData.success) {
          setAiSynthesisEnabled(statusData.enabled ?? true);
        }
        
        const tokensData = await tokensRes.json();
        if (tokensData.success) {
          setTokenUsage({
            limit: tokensData.limit,
            used: tokensData.used,
            remaining: tokensData.remaining,
          });
        }
      } catch (e) {
        console.error("Error verifying status:", e);
        // Default to enabled
        setAiSynthesisEnabled(true);
      }
    };
    if (isOpen) {
      void checkStatus();
    }
  }, [isOpen]);

  // Reload usage after generation
  useEffect(() => {
    if (!generating && isOpen) {
      const reloadTokens = async () => {
        try {
          const res = await fetch("/api/syntheses/tokens");
          const data = await res.json();
          if (data.success) {
            setTokenUsage({
              limit: data.limit,
              used: data.used,
              remaining: data.remaining,
            });
          }
        } catch (e) {
          console.error("Error reloading tokens:", e);
        }
      };
      void reloadTokens();
    }
  }, [generating, isOpen]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [syntheses, isOpen]);

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

  const handleGenerateSynthesis = async () => {
    if (!documentId || !documentContent) {
      setError("Unable to generate synthesis: empty document");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/syntheses/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          documentId,
          content: documentContent,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Unable to generate synthesis");
        return;
      }

      // Add new synthesis to list
      if (data.synthesis) {
        setSyntheses((prev) => [...prev, data.synthesis as SynthesisItem]);
      } else {
        // Fallback reload
        void fetchSyntheses();
      }
    } catch (e) {
      setError("Error generating synthesis");
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <React.Fragment>
      {/* Resizing handle */}
      <div
        onMouseDown={handleResizeStart}
        className={cn(
          "fixed top-0 bottom-0 left-0 z-[60] w-1 cursor-col-resize bg-transparent hover:bg-primary/20 transition-colors",
          "md:block hidden"
        )}
        style={{ left: `calc(100% - ${sidebarWidth}px - 4px)` }}
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1" />
      </div>
      
      <div 
        className="fixed top-0 bottom-0 left-0 right-0 md:left-auto md:right-0 z-50 bg-background md:border-l border-border shadow-xl flex flex-col overflow-hidden"
        style={{ 
          width: isDesktop ? `${sidebarWidth}px` : "100%" 
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="sparkles" className="w-5 h-5" />
          <h2 className="text-xl font-title">AI Synthesis</h2>
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
        <div className="px-4 pt-3 pb-1 space-y-2">
          {!aiSynthesisEnabled && (
            <span className="text-xs text-yellow-600 dark:text-yellow-500 block">
              AI synthesis is disabled by the administrator.
            </span>
          )}
          {aiSynthesisEnabled && loading && <span className="text-xs text-muted-foreground">Loading syntheses…</span>}
          {aiSynthesisEnabled && !loading && !error && syntheses.length === 0 && (
            <span className="text-xs text-muted-foreground">No syntheses yet.</span>
          )}
          {aiSynthesisEnabled && !loading && error && (
            <span className="text-xs text-red-500">{error}</span>
          )}
        </div>
        <ScrollArea className="flex-1 px-2 pb-2 max-h-full overflow-hidden">
          <div className="space-y-3 px-2">
            {syntheses.map((synthesis, index) => {
              const user = synthesis.user ?? null;
              const isCurrentUser = userId && user?.id && String(userId) === String(user.id);
              const synthesisDate = new Date(synthesis.created_at);
              const previousSynthesisDate = index > 0 ? new Date(syntheses[index - 1].created_at) : null;
              const showDateHeader = !previousSynthesisDate || getDateKey(synthesisDate) !== getDateKey(previousSynthesisDate);

              return (
                <div key={synthesis.id} className="space-y-1">
                  {showDateHeader && (
                    <div className="flex items-center justify-center py-2">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {formatDateHeader(synthesisDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex flex-col items-center gap-1 min-w-[60px]">
                      <span className={cn(
                        "text-[9px] text-muted-foreground",
                        isCurrentUser ? "text-right" : "text-left"
                      )}>
                        {formatTime(synthesisDate)}
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
                      <div className="min-w-0 max-w-full overflow-hidden text-left">
                        <div className="flex items-center gap-2 justify-start">
                          <span className={cn(
                            "text-xs font-semibold break-words",
                            isCurrentUser
                              ? "text-[var(--primary-foreground)]"
                              : "text-foreground"
                          )}>
                            {getUserDisplayName(user)}
                          </span>
                        </div>
                        <div className={cn(
                          "mt-1 text-xs break-words prose prose-sm max-w-none text-left",
                          isCurrentUser
                            ? "prose-invert"
                            : "",
                          "[&_*]:text-xs [&_*]:text-left [&_p]:m-0 [&_p]:mb-1 [&_p]:text-left [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ul]:text-left [&_ol]:my-1 [&_ol]:text-left [&_li]:my-0.5 [&_li]:text-left [&_h1]:text-sm [&_h1]:text-left [&_h2]:text-sm [&_h2]:text-left [&_h3]:text-xs [&_h3]:text-left [&_h4]:text-xs [&_h4]:text-left [&_h5]:text-xs [&_h5]:text-left [&_h6]:text-xs [&_h6]:text-left [&_strong]:font-semibold [&_strong]:text-left [&_em]:italic [&_em]:text-left [&_code]:text-[0.7rem] [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-left [&_pre]:text-[0.7rem] [&_pre]:bg-muted/50 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:text-left [&_blockquote]:border-l-2 [&_blockquote]:border-muted [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-left [&_a]:underline [&_a]:text-left"
                        )}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              p: ({ children }) => <p className={cn(
                                "break-words text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]"
                                  : "text-foreground"
                              )}>{children}</p>,
                              strong: ({ children }) => <strong className={cn(
                                "text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]"
                                  : "text-foreground"
                              )}>{children}</strong>,
                              em: ({ children }) => <em className={cn(
                                "text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]"
                                  : "text-foreground"
                              )}>{children}</em>,
                              code: ({ children, className }) => {
                                const isInline = !className;
                                return isInline ? (
                                  <code className={cn(
                                    "text-[0.7rem] bg-muted/50 px-1 py-0.5 rounded text-left",
                                    isCurrentUser
                                      ? "text-[var(--primary-foreground)]"
                                      : "text-foreground"
                                  )}>{children}</code>
                                ) : (
                                  <code className={cn(
                                    "block text-[0.7rem] bg-muted/50 p-2 rounded overflow-x-auto text-left",
                                    isCurrentUser
                                      ? "text-[var(--primary-foreground)]"
                                      : "text-foreground"
                                  )}>{children}</code>
                                );
                              },
                              ul: ({ children }) => <ul className={cn(
                                "list-disc list-inside my-1 space-y-0.5 text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]"
                                  : "text-foreground"
                              )}>{children}</ul>,
                              ol: ({ children }) => <ol className={cn(
                                "list-decimal list-inside my-1 space-y-0.5 text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]"
                                  : "text-foreground"
                              )}>{children}</ol>,
                              li: ({ children }) => <li className={cn(
                                "text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]"
                                  : "text-foreground"
                              )}>{children}</li>,
                              h1: ({ children }) => <h1 className={cn(
                                "text-sm font-bold mt-2 mb-1 text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]"
                                  : "text-foreground"
                              )}>{children}</h1>,
                              h2: ({ children }) => <h2 className={cn(
                                "text-sm font-semibold mt-2 mb-1 text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]"
                                  : "text-foreground"
                              )}>{children}</h2>,
                              h3: ({ children }) => <h3 className={cn(
                                "text-xs font-semibold mt-1 mb-0.5 text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]"
                                  : "text-foreground"
                              )}>{children}</h3>,
                              blockquote: ({ children }) => <blockquote className={cn(
                                "border-l-2 border-muted pl-2 italic my-1 text-left",
                                isCurrentUser
                                  ? "text-[var(--primary-foreground)]/80"
                                  : "text-muted-foreground"
                              )}>{children}</blockquote>,
                              a: ({ children, href }) => <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "underline text-left",
                                  isCurrentUser
                                    ? "text-[var(--primary-foreground)]/90"
                                    : "text-primary"
                                )}
                              >{children}</a>,
                              br: () => <br />,
                            }}
                          >
                            {synthesis.content}
                          </ReactMarkdown>
                        </div>
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
      
      {/* Token estimation and generation section at bottom */}
      {aiSynthesisEnabled && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {tokenUsage !== null && (
              <>
                {estimatedTokens > 0 && (
                  <div className="flex flex-col items-start px-2 py-1 rounded-md bg-muted/30">
                    <span className="text-[10px] text-muted-foreground">Estimation</span>
                    <span className="text-xs font-medium text-foreground">
                      ~{estimatedTokens.toLocaleString()} tokens
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
                  <span className={cn(
                    "text-xs font-medium",
                    tokenUsage.remaining < tokenUsage.limit * 0.1
                      ? "text-red-500"
                      : tokenUsage.remaining < tokenUsage.limit * 0.3
                      ? "text-yellow-500"
                      : "text-muted-foreground"
                  )}>
                    {tokenUsage.used.toLocaleString()}/{tokenUsage.limit.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">tokens</span>
                </div>
              </>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleGenerateSynthesis}
            disabled={generating || !documentContent || !documentId || (tokenUsage !== null && tokenUsage.remaining <= 0) || (tokenUsage !== null && estimatedTokens > tokenUsage.remaining)}
            className="w-full h-9 rounded-sm"
            title={
              tokenUsage !== null && tokenUsage.remaining <= 0 
                ? "Token limit reached for today" 
                : tokenUsage !== null && estimatedTokens > tokenUsage.remaining
                ? `Not enough tokens available (${estimatedTokens.toLocaleString()} needed, ${tokenUsage.remaining.toLocaleString()} available)`
                : undefined
            }
          >
            {generating ? (
              <>
                <Icon name="spinner" className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Icon name="sparkles" className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>
      )}
      </div>
    </React.Fragment>
  );
}
