"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import NotificationItem from "@/components/ui/notifications/notification-item";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Notification } from "@/lib/types";
import { Button } from "@/components/ui/button";
import Icon from "@/components/Icon";
import { useNotification } from "@/contexts/NotificationContext";
import { getNotifications, markAsRead, deleteNotification } from "@/actions/notificationActions";
import { cn } from "@/lib/utils";

interface NotificationOverlayProps {
    isOpen?: boolean;
    onClose?: () => void;
}

function truncateText(s: string, max = 50) {
    if (!s) return s;
    return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export default function NotificationOverlay({ isOpen = true, onClose }: Readonly<NotificationOverlayProps>) {
    const { data: session } = useSession();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { adjustUnreadCount, refresh } = useNotification();

    useEffect(() => {
        if (!isOpen) return;
        const fetchNotifications = async () => {
            if (!session?.user?.id) {
                setNotifications([]);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const result = await getNotifications(Number(session.user.id));
                if (result.success) {
                    setNotifications((result.data as unknown as Notification[]) || []);
                } else {
                    setError(result.error || "Error retrieving notifications");
                    setNotifications([]);
                }
            } catch (e) {
                setError(String(e));
                setNotifications([]);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, [isOpen, session]);

    async function handleDeleteNotification(notificationId: number) {
        if (!notificationId) return false;
        try {
            const result = await deleteNotification(notificationId);
            if (!result.success) return false;
            const found = (notifications ?? []).find(x => x.id === notificationId);
            const wasUnread = found && !found.read_date;
            setNotifications(prev => prev ? prev.filter(x => x.id !== notificationId) : prev);
            if (wasUnread) { try { adjustUnreadCount(-1); } catch {} }
            return true;
        } catch (e) {
            console.error("deleteNotification error", e);
            return false;
        }
    }

    useEffect(() => {
        if (!isOpen) return;
    }, [notifications, loading, error, isOpen]);

    if (!isOpen) return null;

    async function handleMarkAsRead(notificationId: number): Promise<boolean> {
        if (!notificationId) return false;
        setNotifications(prev => prev ? prev.map(n => n.id === notificationId ? { ...n, read_date: new Date() } : n) : prev);
        try {
            const result = await markAsRead(notificationId);
            if (result.success) {
                try { adjustUnreadCount(-1); } catch {}
                return true;
            }
        } catch (e) {
            console.error("markAsRead error", e);
        }
        return false;
    }

    return (
        <aside className="h-screen w-80 bg-card rounded-none shadow-lg p-2 flex flex-col" role="complementary" aria-label="Notifications">
            <div className="flex items-center justify-between p-2 pt-2.5 flex-shrink-0 ">
                <div className="flex items-center gap-2">
                    <h2 className="font-title text-2xl sm:text-3xl font-regular">Notifications</h2>
                    {(notifications ?? []).some(n => !n.read_date && ((n as any).id_sender == null)) && (
                        <button
                            onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const systemIds = (notifications ?? [])
                                    .filter(n => !n.read_date && ((n as any).id_sender == null))
                                    .map(n => n.id);
                                if (systemIds.length === 0) return;
                                await Promise.allSettled(systemIds.map(id => markAsRead(id)));
                            }}
                            title="Mark all notifications as read"
                            className="text-sm px-2 py-1 text-primary" 
                        >
                            Mark all as read
                        </button>
                    )}
                </div>

                <Button onClick={onClose} className="text-foreground hover:bg-primary/70">
                    <Icon name="x" className="w-6 h-6" />
                </Button>
            </div>

            <div className="mt-2 flex-1 overflow-y-auto scroller divide-y divide-border">
                {loading && <div className="p-4">Loading...</div>}
                {error && <div className="p-4 text-destructive">{error}</div>}

                {!loading && !error && (notifications ?? []).length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">No notifications</div>
                )}

                {!loading && (notifications ?? []).map((n: Notification) => {
                    const parsed = (n as any).parsed ?? null;
                    // For request-response and request-resolved notification types,
                    // display a short message instead of the full message to avoid clutter
                    let messageText: string;
                    let hasCustomMessage = false;
                    
                    if (parsed?.type === "request-response" || parsed?.type === "request-resolved") {
                        const requestTitle = parsed?.requestTitle || "your request";
                        const fullMessage = parsed?.message ?? String(n.message || "");
                        
                        // Check if there is a custom message beyond the status change
                        // The API message contains "\n\n" if there is a custom message after the status
                        hasCustomMessage = fullMessage.includes("\n\n");
                        
                        if (parsed?.type === "request-resolved") {
                            const baseMessage = `Your request "${requestTitle}" has been resolved.`;
                            messageText = hasCustomMessage 
                                ? `${baseMessage} Check the support page for more details.`
                                : baseMessage;
                        } else {
                            const statusLabel = parsed?.status === "pending" ? "Pending" :
                                               parsed?.status === "in_progress" ? "In progress" :
                                               parsed?.status === "resolved" ? "Resolved" :
                                               parsed?.status === "rejected" ? "Rejected" : "updated";
                            const baseMessage = `Your request "${requestTitle}" has been ${statusLabel.toLowerCase()}.`;
                            messageText = hasCustomMessage
                                ? `${baseMessage} Check the support page for more details.`
                                : baseMessage;
                        }
                    } else {
                        messageText = parsed?.message ?? String(n.message || "");
                    }
                    const isRead = Boolean(n.read_date);

                    const firstNameFromSender = n.sender_first_name
                        ? String(n.sender_first_name).trim().split(/\s+/)[0]
                        : null;
                    const username = firstNameFromSender || "System";

                    const rawAvatar = n.avatar;
                    const avatarUrl = typeof rawAvatar === "string" ? rawAvatar.trim() : "";

                    if (parsed?.type === "share-invite") {
                        const docTitle = parsed.documentTitle || parsed.title || "a document";
                        const confirmUrl = parsed.url || parsed.confirmUrl;
                        const initial = (username?.charAt(0) || "U").toUpperCase();
                        const displayTitle = truncateText(String(docTitle), 50);

                        return (
                            <div key={n.id} className={`px-2 py-2 ${isRead ? "bg-muted" : ""}`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="w-10 h-10 flex-shrink-0" title={username}>
                                        <AvatarImage src={avatarUrl || undefined} alt={username} />
                                        <AvatarFallback className="text-sm font-medium">{initial}</AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="font-medium text-sm line-clamp-2" title='Note sharing'>
                                            {username} shared a note with you
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate" title={String(docTitle)}>
                                            {displayTitle}
                                        </div>
                                    </div>

                                    <div className="flex-shrink-0">
                                        {isRead ? (
                                            <div className="flex items-center">
                                                <button
                                                    type="button"
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        await handleDeleteNotification(n.id);
                                                    }}
                                                    className="ml-2 p-1 rounded hover:bg-accent/50 text-muted-foreground"
                                                    title="Delete notification"
                                                    aria-label="Delete notification"
                                                >
                                                    <Icon name="trash" className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-row items-stretch gap-2">
                                                <Button
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const ok = await markAsRead(n.id);
                                                        // remove the share notification from the list after accept
                                                        setNotifications(prev => prev ? prev.filter(x => x.id !== n.id) : prev);
                                                        if (confirmUrl) window.location.href = confirmUrl;
                                                    }}
                                                    className="bg-primary text-primary-foreground p-1 rounded"
                                                >
                                                    <Icon name="check" className="w-6 h-6" />
                                                </Button>

                                                <Button
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const ok = await markAsRead(n.id);
                                                        // remove share invite after decline
                                                        setNotifications(prev => prev ? prev.filter(x => x.id !== n.id) : prev);
                                                    }}
                                                    className="text-primary p-1 rounded hover:bg-primary/10"
                                                    variant="ghost"
                                                >
                                                    <Icon name="x" className="w-6 h-6" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    const idSender = Object.prototype.hasOwnProperty.call(n, "id_sender")
                        ? (n as any).id_sender
                        : undefined;

                    // Check if it's a support request notification with a custom message
                    const isRequestNotificationWithMessage = 
                        (parsed?.type === "request-response" || parsed?.type === "request-resolved") &&
                        hasCustomMessage;

                    const handleNotificationClick = () => {
                        if (!isRead) {
                            void markAsRead(n.id);
                        }
                        
                        // If it's a request notification with a message, redirect to the assistance page in history mode
                        if (isRequestNotificationWithMessage) {
                            onClose?.();
                            router.push("/assistance?view=history");
                        }
                    };

                    return (
                        <div 
                            key={`item-${n.id}`} 
                            className={cn(
                                isRead ? "bg-muted" : "",
                                isRequestNotificationWithMessage && "cursor-pointer"
                            )}
                        >
                            <NotificationItem
                                key={n.id}
                                id_sender={idSender}
                                notificationId={n.id}
                                avatar={avatarUrl}
                                username={String(username)}
                                message={messageText}
                                isRead={isRead}
                                onClick={handleNotificationClick}
                                onMarkRead={(id) => { void handleMarkAsRead(id); }}
                                onDelete={(id) => {
                                    const found = (notifications ?? []).find(x => x.id === id);
                                    const wasUnread = found && !found.read_date;
                                    if (wasUnread) {
                                        try { adjustUnreadCount(-1); } catch {}
                                    }
                                    setNotifications(prev => prev ? prev.filter(x => x.id !== id) : prev);
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}