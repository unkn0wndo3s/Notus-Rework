import React from "react";
import Icon from "@/components/Icon";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
    avatar?: string | null;
    username: string;
    id_sender?: number | null;
    message: string;
    notificationId?: number; // id of the notification to delete
    onClick?: () => void;
    onDelete?: (id: number) => void; // optional callback after successful delete
    onMarkRead?: (id: number) => void; // optional callback to mark as read
    isRead?: boolean;
}

export default function NotificationItem({
    avatar,
    username,
    id_sender,
    message,
    notificationId,
    onClick,
    onDelete,
    onMarkRead,
    isRead = false,
}: Readonly<NotificationItemProps>) {
    const isSystem = id_sender !== undefined
        ? id_sender === null
        : (username || "").toLowerCase() === "system" || avatar === "system";

    const normalizedAvatar = typeof avatar === "string" ? avatar.trim() : "";
    const hasAvatar = !!normalizedAvatar && normalizedAvatar !== "null" && normalizedAvatar !== "undefined";

    const [imgError, setImgError] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [marking, setMarking] = React.useState(false);

    React.useEffect(() => {
        setImgError(false);
    }, [normalizedAvatar]);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (deleting) return;
        performDelete();
    };

    const performDelete = async () => {
        if (!notificationId || deleting) return;
        setDeleting(true);
        try {
            const url = `/api/notification/delete?id=${encodeURIComponent(String(notificationId))}`;
            const res = await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" } });
            if (!res.ok) {
                let body: any = null;
                try { body = await res.json(); } catch {}
                const errMsg = body?.error || `Server returned ${res.status}`;
                console.error("Failed to delete notification:", errMsg);
                alert("Failed to delete notification: " + errMsg);
                return;
            }
            onDelete?.(notificationId);
        } catch (err) {
            console.error("Failed to delete notification", err);
            alert("Failed to delete notification");
        } finally {
            setDeleting(false);
        }
    };

    const handleMarkRead = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!notificationId || marking || isRead) return;
        setMarking(true);
        try {
            onMarkRead?.(notificationId);
        } catch (err) {
            console.error("mark read failed", err);
        } finally {
            setMarking(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
        }
    };

    return (
        <>
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            className={cn(
                "w-full flex flex-row items-center text-left px-3 py-2 rounded hover:bg-muted text-foreground",
                onClick && "cursor-pointer"
            )}
        >
            {isSystem ? null : (
                hasAvatar && !imgError ? (
                    <img
                        src={normalizedAvatar}
                        alt={username || "avatar"}
                        className="w-8 h-8 rounded-full mr-3 object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full mr-3 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    </div>
                )
            )}

            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{isSystem ? "System" : username || "User"}</span>
                    <div className="flex items-center gap-2">
                        {!isRead && (
                            <button
                                type="button"
                                onClick={handleMarkRead}
                                className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
                                title="Mark as read"
                                aria-label="Mark as read"
                                disabled={marking}
                            >
                                <Icon name="check" className="w-4 h-4" />
                            </button>
                        )}

                        {/* Trash button */}
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            className={`ml-2 p-1 rounded hover:bg-accent/50 text-muted-foreground ${deleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Delete notification"
                            aria-label="Delete notification"
                            disabled={deleting}
                        >
                            <Icon name="trash" className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <span className={cn("text-sm text-muted-foreground max-w-[260px] break-words")} title={message || ""}>
                    {message || ""}
                </span>
            </div>
        </div>
        {/* immediate delete — no confirmation popin */}
        </>
    );
}