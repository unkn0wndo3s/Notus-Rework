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

const getNotificationDetails = (n: Notification) => {
    const parsed = (n as any).parsed ?? null;
    let messageText: string;
    let hasCustomMessage = false;
    let isRequestNotificationWithMessage = false;

    const getRequestStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'Pending';
            case 'in_progress': return 'In progress';
            case 'resolved': return 'Resolved';
            case 'rejected': return 'Rejected';
            default: return 'updated';
        }
    };

    const parsedTyped = parsed as { 
        type?: string; 
        requestTitle?: string; 
        message?: string; 
        status?: string;
        documentTitle?: string;
        title?: string;
        url?: string;
        confirmUrl?: string;
    } | null;

    if (parsedTyped?.type === "request-response" || parsedTyped?.type === "request-resolved") {
        const requestTitle = parsedTyped.requestTitle || "your request";
        const fullMessage = parsedTyped.message ?? String(n.message || "");
        hasCustomMessage = fullMessage.includes("\n\n");
        const baseMessage = parsedTyped.type === "request-resolved"
            ? `Your request "${requestTitle}" has been resolved.`
            : `Your request "${requestTitle}" has been ${getRequestStatusLabel(parsedTyped.status || '').toLowerCase()}.`;
            
        messageText = hasCustomMessage 
            ? `${baseMessage} Check the support page for more details.`
            : baseMessage;
            
        isRequestNotificationWithMessage = hasCustomMessage;
    } else {
        messageText = parsedTyped?.message ?? String(n.message || "");
    }
    
    return { messageText, isRequestNotificationWithMessage, parsed: parsedTyped };
};

// Extracted component for Share Invite Notification
const ShareInviteNotification = ({ 
    n, 
    isRead, 
    username, 
    avatarUrl, 
    initial, 
    displayTitle, 
    parsed, 
    onDelete, 
    onMarkRead, 
    setNotifications 
}: { 
    n: Notification; 
    isRead: boolean; 
    username: string; 
    avatarUrl: string; 
    initial: string; 
    displayTitle: string; 
    parsed: any; 
    onDelete: (id: number) => Promise<boolean>; 
    onMarkRead: (id: number) => Promise<boolean>; 
    setNotifications: React.Dispatch<React.SetStateAction<Notification[] | null>>; 
}) => {
    const confirmUrl = parsed.url || parsed.confirmUrl;

    return (
        <div className={`px-2 py-2 ${isRead ? "bg-muted" : ""}`}>
            <div className="flex items-center gap-3 min-w-0">
                <Avatar className="w-10 h-10 flex-shrink-0" title={username}>
                    <AvatarImage src={avatarUrl || undefined} alt={username} />
                    <AvatarFallback className="text-sm font-medium">{initial}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 pr-2">
                    <div className="font-medium text-sm line-clamp-2" title='Note sharing'>
                        {username} shared a note with you
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={String(parsed.documentTitle || parsed.title || "a document")}>
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
                                    await onDelete(n.id);
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
                                    await onMarkRead(n.id);
                                    setNotifications(prev => prev ? prev.filter(x => x.id !== n.id) : prev);
                                    if (confirmUrl) globalThis.window.location.href = confirmUrl;
                                }}
                                className="bg-primary text-primary-foreground p-1 rounded"
                            >
                                <Icon name="check" className="w-6 h-6" />
                            </Button>

                            <Button
                                onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    await onMarkRead(n.id);
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
};

// Extracted component for Generic Notification
const GenericNotification = ({
    n,
    isRead,
    username,
    avatarUrl,
    messageText,
    isRequestNotificationWithMessage,
    onClose,
    router,
    onMarkRead,
    onDelete,
    adjustUnreadCount,
    setNotifications
}: {
    n: Notification;
    isRead: boolean;
    username: string;
    avatarUrl: string;
    messageText: string;
    isRequestNotificationWithMessage: boolean;
    onClose?: () => void;
    router: any;
    onMarkRead: (id: number) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
    adjustUnreadCount: (amount: number) => void;
    setNotifications: React.Dispatch<React.SetStateAction<Notification[] | null>>;
}) => {
    const idSender = Object.hasOwn(n, "id_sender")
        ? (n as any).id_sender
        : undefined;

    const handleNotificationClick = () => {
        if (!isRead) {
            void onMarkRead(n.id);
        }
        
        // If it's a request notification with a message, redirect to the assistance page in history mode
        if (isRequestNotificationWithMessage) {
            onClose?.();
            router.push("/assistance?view=history");
        }
    };

    return (
        <div 
            className={cn(
                isRead ? "bg-muted" : "",
                isRequestNotificationWithMessage && "cursor-pointer"
            )}
        >
            <NotificationItem
                id_sender={idSender}
                notificationId={n.id}
                avatar={avatarUrl}
                username={username}
                message={messageText}
                isRead={isRead}
                onClick={handleNotificationClick}
                onMarkRead={(id) => { void onMarkRead(id); }}
                onDelete={(id) => {
                    void onDelete(id);
                }}
            />
        </div>
    );
};

export default function NotificationOverlay({ isOpen = true, onClose }: Readonly<NotificationOverlayProps>) {
    const { data: session } = useSession();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { adjustUnreadCount } = useNotification();

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
                    setNotifications((result.notifications as unknown as Notification[]) || []);
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
        <aside className="h-screen w-80 bg-card rounded-none shadow-lg p-2 flex flex-col" aria-label="Notifications">
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
                    const { messageText, isRequestNotificationWithMessage, parsed } = getNotificationDetails(n);
                    const isRead = Boolean(n.read_date);

                    const firstNameFromSender = n.sender_first_name
                        ? String(n.sender_first_name).trim().split(/\s+/)[0]
                        : null;
                    const username = firstNameFromSender || "System";

                    const rawAvatar = n.avatar;
                    const avatarUrl = typeof rawAvatar === "string" ? rawAvatar.trim() : "";

                    if (parsed?.type === "share-invite") {
                        const docTitle = parsed.documentTitle || parsed.title || "a document";
                        const initial = (username?.charAt(0) || "U").toUpperCase();
                        const displayTitle = truncateText(String(docTitle), 50);

                        return (
                            <div key={n.id}>
                                <ShareInviteNotification 
                                    n={n}
                                    isRead={isRead}
                                    username={username}
                                    avatarUrl={avatarUrl}
                                    initial={initial}
                                    displayTitle={displayTitle}
                                    parsed={parsed}
                                    onDelete={handleDeleteNotification}
                                    onMarkRead={handleMarkAsRead}
                                    setNotifications={setNotifications}
                                />
                            </div>
                        );
                    }

                    return (
                        <div key={`item-${n.id}`}>
                            <GenericNotification
                                n={n}
                                isRead={isRead}
                                username={String(username)}
                                avatarUrl={avatarUrl}
                                messageText={messageText}
                                isRequestNotificationWithMessage={isRequestNotificationWithMessage}
                                onClose={onClose}
                                router={router}
                                onMarkRead={handleMarkAsRead}
                                onDelete={handleDeleteNotification}
                                adjustUnreadCount={adjustUnreadCount}
                                setNotifications={setNotifications}
                            />
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}