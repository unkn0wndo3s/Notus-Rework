import React, { useState, useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import Image from "next/image";
import { updateShareAction, removeShareAction } from "@/actions/documentActions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type User = {
  id: number | null;
  name: string;
  avatarUrl: string;
  permission: boolean;
  email?: string | null;
};

interface UserListProps {
  users: User[];
  currentUserId?: string | number;
  documentId: number;
  onChanged?: () => Promise<void> | void;
  isOwner?: boolean;
}

export default function UserList({
  users,
  currentUserId,
  documentId,
  onChanged,
  isOwner,
}: Readonly<UserListProps>) {
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [localUsers, setLocalUsers] = useState<User[]>(users);
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const [removeModalOpen, setRemoveModalOpen] = useState<boolean>(false);
  const [selectedEmailToRemove, setSelectedEmailToRemove] = useState<string | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (removeModalOpen) {
      // ensure the confirm button receives focus when the popin opens
      setTimeout(() => confirmBtnRef.current?.focus(), 0);
    }
  }, [removeModalOpen]);
  
  const firstUser = localUsers?.[0];
  const ownerId = firstUser?.id !== null && firstUser?.id !== undefined ? Number(firstUser.id) : null;
  const connectedId = currentUserId !== undefined && currentUserId !== null ? Number(currentUserId) : null;
  const isConnectedOwner = isOwner ?? (ownerId !== null && connectedId !== null && ownerId === connectedId);
  
  useEffect(() => setLocalUsers(users), [users]);

  async function handleSetPermission(targetEmail: string | undefined | null, newPermission: boolean) {
    if (!targetEmail) {
      alert("Could not find user email");
      return;
    }

    const prev = localUsers;
    setLocalUsers(prevList => prevList.map(u => u.email?.toLowerCase() === targetEmail.toLowerCase() ? { ...u, permission: newPermission } : u));
    setLoadingEmail(targetEmail);

    try {
      const result = await updateShareAction(documentId, targetEmail, newPermission);
      
      if (!result.success) {
        throw new Error(result.error || 'Server error');
      }
      setMenuOpenId(null);
      setLoadingEmail(null);
      if (onChanged) {
        try { await onChanged(); } catch (e) {
          console.error(e);
        }
      }
    } catch (err) {
      setLocalUsers(prev);
      setLoadingEmail(null);
      alert('Could not modify permission: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleRemoveUser(targetEmail: string | undefined | null) {
    if (!targetEmail) {
      alert("Could not find user email");
      return;
    }

    try {
      const result = await removeShareAction(documentId, targetEmail);
      
      if (!result.success) {
        throw new Error(result.error || 'Server error');
      }
      setMenuOpenId(null);
      setLoadingEmail(null);
      if (onChanged) {
        try { await onChanged(); } catch (e) {
          console.error(e);
        }
      }
    } catch (err) {
      alert('Could not remove user: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div className="space-y-4">
      {localUsers.map((user, idx) => (
        <div
          key={String(user.email ?? user.id ?? idx)}
          className="flex items-center bg-secondary justify-between px-2 py-2 rounded-lg hover:bg-muted/50 transition relative"
        >
          <div className="flex items-center gap-3">
            {user.avatarUrl && user.avatarUrl !== ""
              ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.name}
                  width={40}
                  height={40}
                  unoptimized
                  className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition"
                />
              ) : (
                <span className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg bg-secondary text-secondary-foreground select-none uppercase hover:opacity-80 transition">
                  {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                </span>
              )
            }
            <div className="flex flex-col">
              <span>
                {user.name}
                {user.id === connectedId && (
                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {(() => {
                  if (idx === 0) return "Owner";
                  return user.permission ? "Editor" : "Viewer";
                })()}
              </span>
            </div>
          </div>
          {isConnectedOwner && user.id !== ownerId ? (
            <DropdownMenu 
              open={menuOpenId === user.id} 
              onOpenChange={(open) => setMenuOpenId(open ? (user.id ?? null) : null)}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More options"
                  className="p-2 rounded hover:bg-accent/50"
                  onClick={() => setMenuOpenId(prev => prev === (user.id ?? null) ? null : (user.id ?? null))}
                >
                  <Icon name="dotsHorizontal" className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => handleSetPermission(user.email, true)}
                  aria-disabled={loadingEmail !== null}
                >
                  {loadingEmail === user.email ? '...' : 'Make editor'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSetPermission(user.email, false)}
                  aria-disabled={loadingEmail !== null}
                >
                  {loadingEmail === user.email ? '...' : 'Make viewer'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    // close dropdown first to avoid portal / document mousedown races
                    setMenuOpenId(null); 
                    setTimeout(() => {
                      setSelectedEmailToRemove(user.email ?? null);
                      setRemoveModalOpen(true);
                    }, 0);
                  }}
                  aria-disabled={loadingEmail !== null}
                >
                  {loadingEmail === user.email ? '...' : 'Remove'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ))}
      {removeModalOpen && (
        <dialog
          open
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-transparent border-none p-0 m-0 w-full h-full"
        >
          <div
            className="absolute inset-0 bg-foreground/50"
            aria-hidden="true"
            onClick={() => { setRemoveModalOpen(false); setSelectedEmailToRemove(null); }}
          />
          <div 
            className="relative w-full max-w-md bg-background rounded-lg p-6 shadow-lg z-10"
          >
            <div className="sr-only">Confirm removal dialog</div>
            <header className="mb-4 text-center">
              <h2 id="userlist-confirm-title" className="text-2xl font-title font-bold text-foreground">Confirm Removal</h2>
            </header>
            <main id="userlist-confirm-desc" className="text-center">
              <p>Are you sure you want to remove this user from the document?</p>
            </main>
            <div className="mt-6 flex justify-center space-x-3">
              <Button asChild variant="primary">
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      await handleRemoveUser(selectedEmailToRemove);
                    } finally {
                      setRemoveModalOpen(false);
                      setSelectedEmailToRemove(null);
                    }
                  }}
                  disabled={loadingEmail !== null && selectedEmailToRemove === loadingEmail}
                >
                  Yes
                </button>
              </Button>
              <Button asChild variant="ghost">
                <button type="button" onClick={() => { setRemoveModalOpen(false); setSelectedEmailToRemove(null); }}>
                  No
                </button>
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
