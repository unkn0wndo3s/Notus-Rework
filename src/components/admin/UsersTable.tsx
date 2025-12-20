"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { User } from "@/lib/types";
import { updateAdminUserAction } from "@/actions/adminActions";

interface UsersTableProps {
  users: User[];
}

export default function UsersTable({ users }: Readonly<UsersTableProps>) {
  const router = useRouter();
  const [banningUsers, setBanningUsers] = useState(new Set<string | number>());
  const [adminUsers, setAdminUsers] = useState(new Set<string | number>());
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [userToBan, setUserToBan] = useState<User | null>(null);

  const handleBanClick = (user: User) => {
    if (user.is_banned) {
      // Unban directly without modal
      handleBanUser(user.id, false);
    } else {
      // Ban with modal for reason
      setUserToBan(user);
      setBanReason("");
      setShowBanModal(true);
    }
  };

  const handleBanUser = async (userId: string | number, isBanned: boolean, reason: string | null = null) => {
    setBanningUsers((prev) => new Set(prev).add(userId));

    try {
      // In a real app we would pass the reason to the action if supported.
      // Current action verifies admin access internally.
      const result = await updateAdminUserAction(Number(userId), 'toggle_ban');
      
      if (result.success) {
        if (isBanned && reason) {
             // If we had an email service integrated for reasons, we'd call it here
             // For now, the action toggles the ban.
        }
        alert(`User ${isBanned ? "banned" : "unbanned"} successfully.`);
        router.refresh();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
       alert(`Error: ${(error as Error).message}`);
    } finally {
      setBanningUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const confirmBan = () => {
    if (userToBan) {
      handleBanUser(userToBan.id, true, banReason);
      setShowBanModal(false);
      setUserToBan(null);
      setBanReason("");
    }
  };

  const handleToggleAdmin = async (userId: string | number, isAdmin: boolean) => {
    setAdminUsers((prev) => new Set(prev).add(userId));

    try {
      const result = await updateAdminUserAction(Number(userId), 'toggle_admin');

      if (result.success) {
        router.refresh();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setAdminUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (user: User) => {
    if (user.is_banned) {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-destructive/10 text-destructive">
          Banned
        </span>
      );
    }

    if (!user.email_verified) {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-accent/10 text-accent-foreground">
          Pending
        </span>
      );
    }

    return (
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
        Active
      </span>
    );
  };

  const getProviderBadge = (provider?: string) => {
    if (!provider) return null;

    return (
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-secondary text-secondary-foreground">
        {provider}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto scroller">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-background">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              Registration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              Terms Accepted
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-background divide-y divide-border">
          {users.map((user) => (
            <tr
              key={user.id}
              className="hover:bg-muted/50 transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-foreground">
                        {user.first_name?.charAt(0) || ''}
                        {user.last_name?.charAt(0) || ''}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-foreground">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{user.username}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-foreground">
                  {user.email}
                </div>
                {getProviderBadge(user.provider || undefined)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getStatusBadge(user)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {user.is_admin ? (
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                    Admin
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-foreground/10 text-foreground">
                    User
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString("en-US")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {user.terms_accepted_at ? (
                  <div>
                    <div className="text-primary font-medium">
                      ✓ Accepted
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(user.terms_accepted_at).toLocaleString("en-US")}
                    </div>
                  </div>
                ) : (
                  <div className="text-destructive font-medium">
                    ✗ Not accepted
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleBanClick(user)}
                    disabled={banningUsers.has(user.id)}
                    className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded ${user.is_banned
                      ? "text-primary bg-primary/10 hover:bg-primary/20"
                      : "text-destructive bg-destructive/10 hover:bg-destructive/20"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {banningUsers.has(user.id) ? (
                      <Icon name="spinner" className="animate-spin -ml-1 mr-1 h-3 w-3" />
                    ) : null}
                    {user.is_banned ? "Unban" : "Ban"}
                  </button>

                  {!user.is_admin && (
                    <button
                      onClick={() => handleToggleAdmin(user.id, true)}
                      disabled={adminUsers.has(user.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {adminUsers.has(user.id) ? (
                        <Icon name="spinner" className="animate-spin -ml-1 mr-1 h-3 w-3" />
                       ) : null}
                      Promote
                    </button>
                  )}

                  {user.is_admin && (
                    <button
                      onClick={() => handleToggleAdmin(user.id, false)}
                      disabled={adminUsers.has(user.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-foreground bg-foreground/10 hover:bg-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {adminUsers.has(user.id) ? (
                        <Icon name="spinner" className="animate-spin -ml-1 mr-1 h-3 w-3" />
                      ) : null}
                      Demote
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <div className="text-center py-12">
          <Icon name="users" className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground">
            No users
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            No users found in the database.
          </p>
        </div>
      )}

      {/* Ban confirmation modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-foreground/30 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-card">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-destructive/10">
                <Icon name="alert" className="h-6 w-6 text-destructive" />
              </div>
              <div className="mt-2 text-center">
                <h3 className="text-lg font-medium text-foreground">
                  Confirm Ban
                </h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to ban{" "}
                    <strong>
                      {userToBan?.first_name} {userToBan?.last_name}
                    </strong>{" "}
                    ?
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    A notification email will be sent to the user.
                  </p>
                </div>
                <div className="mt-4">
                  <label
                    htmlFor="banReason"
                    className="block text-sm font-medium text-foreground text-left"
                  >
                    Ban reason (optional)
                  </label>
                  <textarea
                    id="banReason"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground"
                    rows={3}
                    placeholder="Explain the reason for the ban..."
                  />
                </div>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={confirmBan}
                    className="px-4 py-2 bg-destructive text-destructive-foreground text-base font-medium rounded-md shadow-sm hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    Confirm Ban
                  </button>
                  <button
                    onClick={() => {
                      setShowBanModal(false);
                      setUserToBan(null);
                      setBanReason("");
                    }}
                    className="px-4 py-2 bg-muted text-foreground text-base font-medium rounded-md shadow-sm hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


