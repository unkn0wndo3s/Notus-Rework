import React, { useRef, useState } from "react";
import Icon from "@/components/Icon";
import Image from "next/image"; // Added import
import UserList from "./UserList";
import { cn } from "@/lib/utils";

type User = {
  id: number;
  name: string;
  avatarUrl: string;
  email?: string;
  permission?: boolean;
};

interface UserListButtonProps {
  users: User[];
  className?: string;
  documentId?: number;
  onAccessListRefresh?: () => Promise<void> | void;
  isOwner?: boolean;
  currentUserId?: string | number | null;
}

export default function UserListButton({
  users,
  className,
  documentId,
  onAccessListRefresh,
  isOwner,
  currentUserId
}: Readonly<UserListButtonProps>) {
  const [errored, setErrored] = useState<{ [id: string]: boolean }>({});
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const userCount = users.length;
  const hasMultipleUsers = userCount > 1;

  // Close overlay on outside click (not when clicking inside overlay or button)
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      // If the click is inside the toggle button, ignore
      if (buttonRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      try {
        const el = target as Element | null;
        if (el && el instanceof Element) {
          if (el.closest('[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu"]')) {
            return;
          }
        }
      } catch (err) {
        console.error("Error in click outside handler:", err);
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const renderAvatar = (user: User, index: number, size: "lg" | "md", showBadge?: boolean, badgeCount?: number) => {
    const sizeClasses = {
      lg: "w-10 h-10 text-base",
      md: "w-9 h-9 text-sm",
    };
    const sizeValue = sizeClasses[size];
    const hasAvatar = user.avatarUrl && user.avatarUrl !== "" && !errored[user.id];
    const initial = user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "?";

    return (
      <span
        key={user.id}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full bg-[var(--card)]",
          sizeValue,
          index === 0 ? "z-10" : "z-0",
        )}
      >
        {hasAvatar ? (
          <Image
            src={user.avatarUrl}
            alt={user.name}
            width={40}
            height={40}
            unoptimized
            className="w-full h-full rounded-full object-cover"
            onError={() => setErrored((e) => ({ ...e, [user.id]: true }))}
          />
        ) : (
          <span className="w-full h-full rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)] flex items-center justify-center font-semibold">
            {initial}
          </span>
        )}
        {showBadge && badgeCount !== undefined && badgeCount > 0 && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full",
              "bg-[var(--primary)] text-[var(--primary-foreground)]",
              "border-2 border-[var(--card)]",
              "text-[10px] font-semibold leading-none",
              "min-w-[1.125rem] h-[1.125rem] px-1"
            )}
            title={`${badgeCount} other user${badgeCount > 1 ? "s" : ""}`}
          >
            +{badgeCount}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-label={`${userCount} user${userCount > 1 ? "s" : ""} connected`}
        aria-expanded={open}
        className={cn(
          "relative flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer",
          "hover:bg-background transition-colors",
          hasMultipleUsers ? "pr-3" : "pr-2.5"
        )}
      >
        <div className={cn("flex items-center", hasMultipleUsers ? "-space-x-2" : "")}>
          {users[0] && renderAvatar(users[0], 0, "lg")}
          {users[1] && renderAvatar(users[1], 1, "md", userCount > 2, userCount > 2 ? userCount - 2 : undefined)}
        </div>

        <span
          className={cn(
            "flex items-center justify-center shrink-0",
            "text-[var(--muted-foreground)]",
            "transition-transform duration-200",
            open && "rotate-180"
          )}
        >
          <Icon name="chevronDown" className={cn(hasMultipleUsers ? "w-4 h-4" : "w-3.5 h-3.5")} />
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={overlayRef}
            className={cn(
              "absolute mt-2 z-50 min-w-56 max-w-sm",
              "bg-[var(--card)] text-[var(--card-foreground)]",
              "rounded-xl shadow-lg border border-[var(--border)]",
              "p-2 left-auto right-0 w-auto"
            )}
          >
            <UserList
              users={users.map((u) => ({
                ...u,
                id: Number(u.id),
                permission: u.permission ?? false,
              }))}
              currentUserId={currentUserId ?? undefined}
              documentId={documentId ?? (users[0]?.id ?? (undefined as any))}
              onChanged={onAccessListRefresh}
              isOwner={isOwner}
            />
          </div>
        </>
      )}
    </div>
  );
}