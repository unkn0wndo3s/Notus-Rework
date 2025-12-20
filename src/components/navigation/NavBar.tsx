"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image  from "next/image";
import { useSession } from "next-auth/react";
import NotificationOverlay from "@/components/common/notifications/NotificationOverlay";
import { Logo, Input, Button } from "@/components/ui";
import Icon, { type IconName } from "@/components/Icon";
import { useLocalSession } from "@/hooks/useLocalSession";
import { useNotification } from "@/contexts/NotificationContext";
import { useSearch } from "@/contexts/SearchContext";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";
import LoginRequiredModal from "@/components/auth/LoginRequiredModal";
import BadgeIcon from "../ui/notifications/badge-icon";
import NotesFilterModal from "@/components/documents/NotesFilterModal";

interface NavItem {
  name: string;
  href: string;
  onClick?: (e: React.MouseEvent) => void;
  icon: IconName;
  mobileHidden?: boolean;
  unreadNotifications?: number;
}

export default function NavBar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const router = useRouter();
  const { searchQuery, startSearch, clearSearch, hasActiveFilters } = useSearch();
  const { data: session, status } = useSession();
  const { logout } = useLocalSession();
  const { guardedNavigate } = useGuardedNavigate();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isLoggedIn = status === "authenticated" && session?.user;
  const userName = session?.user?.name || (session?.user as any)?.firstName || null;
  const username = (session?.user as any)?.username || null;
  const profileImage = (session?.user as any)?.profileImage || null;
  const [localProfileImage, setLocalProfileImage] = useState<string | null>(profileImage);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  useEffect(() => { setLocalProfileImage(profileImage); }, [profileImage]);
  useEffect(() => {
    const fetchProfileImage = async () => {
      if (isLoggedIn && !profileImage) {
        try {
          const response = await fetch("/api/profile-image");
          if (response.ok) {
            const data = await response.json();
            if (data.profileImage) setLocalProfileImage(data.profileImage);
          }
        } catch {}
      }
    };
    fetchProfileImage();
  }, [isLoggedIn, profileImage]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!isLoggedIn) {
        setAdminLoading(false);
        return;
      }
      try {
        const response = await fetch("/api/admin/check-status");
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Error verifying admin status:", error);
      } finally {
        setAdminLoading(false);
      }
    };

    checkAdminStatus();
  }, [isLoggedIn]);

  const { unreadCount, refresh } = useNotification();

  const items: NavItem[] = [
    { name: "My notes", href: "/app", icon: "note" },
    { name: "Favorites", href: "/favorites", icon: "star" },
    { name: "Folders", href: "/folders", icon: "folder" },
    { name: "Support", href: "/support", icon: "alert" },
    { name: "Notifications", href: "#", icon: "bell", onClick: (e) => { e.preventDefault(); handleNotificationOverlay(e); }, mobileHidden: true, unreadNotifications: unreadCount },
    { name: "Trash", href: "/trash", icon: "trash" },
  ];

  const pageTitle = getPageTitle(pathname, items);

  const handleLogout = async () => {
    try {
      if (isLoggedIn) { router.push("/logout"); } else { await guardedNavigate("/login"); }
    } catch {} finally { setIsOpen(false); }
  };

  const handleDesktopSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const q = searchQuery.trim();
      if (q.length > 0) startSearch(q); else clearSearch();
    }
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value; if (value.length > 0) startSearch(value); else clearSearch();
  };
  const handleNavItemClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault(); setIsOpen(false);
    if ((href === "/favorites" || href === "/trash" || href === "/folders" || href === "/support") && !isLoggedIn) { setShowLoginModal(true); return; }
    guardedNavigate(href);
  };
  const handleNotificationOverlay = (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    if (!mounted || !isLoggedIn) { setShowLoginModal(true); return; }
    setShowNotifications((prev) => { const next = !prev; if (next) setIsOpen(false); return next; });
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-background">
        <div className="w-full px-2 h-16 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
            <button aria-label="Open menu" onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 rounded-md hover:bg-accent/20 text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors duration-200 ease-in-out">
              <Icon name="menu" className="w-6 h-6" />
            </button>
            <span className="font-title text-2xl sm:text-3xl font-regular text-foreground leading-tight">{pageTitle}</span>
            <button type="button" className="items-center hidden md:flex cursor-pointer" onClick={() => guardedNavigate("/app")} aria-label="Home">
              <Logo width={160} height={46} />
            </button>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            {mounted && isLoggedIn && (
              <>
                <button aria-label="Notifications" onClick={handleNotificationOverlay} className={`p-2 rounded-md hover:bg-accent/20 text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors duration-200 ease-in-out ${showNotifications ? 'bg-accent' : ''}`} title="Notifications">
                  <BadgeIcon name="bell" count={unreadCount} />
                </button>
                <button type="button" onClick={() => guardedNavigate("/profile")} aria-label="Profile" className="ml-1 inline-flex items-center justify-center w-8 h-8 rounded-full overflow-hidden bg-muted ring-1 ring-border/20 shadow-sm" title={userName || "Profile"}>
                  {localProfileImage ? (
                    <img src={localProfileImage} alt="Profile photo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center">{getInitials(userName)}</div>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-background border-r-2 border-border/50 p-4 flex flex-col">
            <div className="flex items-center justify-end mb-4">
              <button aria-label="Close" onClick={() => setIsOpen(false)} className="p-2 rounded-sm hover:bg-accent/20 text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors duration-200 ease-in-out">
                <Icon name="x" className="w-6 h-6" />
              </button>
            </div>
            <nav className="space-y-1 flex-1 overflow-y-auto">
              <div className="flex justify-center mb-3 p-3">
                <button type="button" onClick={() => { setIsOpen(false); guardedNavigate("/app"); }} className="inline-flex items-center cursor-pointer" aria-label="Home">
                  <Logo width={160} height={46} />
                </button>
              </div>
              <div className="px-3 mb-3">
                <div className="flex items-center gap-2">
                  <Input className="flex-1" placeholder="Search..." value={searchQuery} onChange={handleSearchChange} onKeyDown={handleDesktopSearchKeyDown} />
                  <button
                    type="button"
                    onClick={() => { setShowFiltersModal(true); setIsOpen(false); }}
                    className={`inline-flex items-center justify-center h-10 w-10 rounded-md border border-border transition-colors duration-200 ease-in-out ${hasActiveFilters ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent/20"}`}
                    aria-pressed={hasActiveFilters}
                    aria-label="Open filters"
                    title="Filter notes"
                  >
                    <Icon name="filter" className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="pt-3"></div>
              <div className="px-2 space-y-2">
                {items.filter((i) => !i.mobileHidden).map((item) => (
                  item.onClick ? (
                    <button key={item.href} onClick={(e) => { e.preventDefault(); item.onClick?.(e); setIsOpen(false); }} className={`w-full flex items-center gap-2 p-2 rounded-sm hover:bg-accent/20 text-foreground transition-colors duration-200 ease-in-out ${pathname === item.href || (item.name === 'Notifications' && showNotifications) ? 'bg-accent' : ''}`}>
                      <div className="relative flex items-center">
                        {/* show badge only for Notifications item */}
                        <BadgeIcon name={item.icon} count={item.name === "Notifications" ? item.unreadNotifications ?? undefined : undefined} className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-sm">{item.name}</span>
                    </button>
                  ) : (
                    <Link key={item.href} href={item.href} onClick={(e) => handleNavItemClick(e, item.href)} className={`flex items-center gap-2 p-3 rounded-sm hover:bg-accent/20 text-foreground transition-colors duration-200 ease-in-out ${pathname === item.href || (item.name === 'Notifications' && showNotifications) ? 'bg-accent' : ''}`}>
                      <div className="relative flex items-center">
                        <BadgeIcon name={item.icon} count={item.name === "Notifications" ? item.unreadNotifications ?? undefined : undefined} className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-sm">{item.name}</span>
                    </Link>
                  )
                ))}
              </div>
            </nav>
            <div className="pt-4 space-y-3">
              {mounted && isLoggedIn ? (
                <>
                  <Link
                    href="/support"
                    onClick={(e) => handleNavItemClick(e, "/support")}
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 ease-in-out"
                  >
                    Need help?
                  </Link>
              <div className="flex items-center gap-3 border-t border-border pt-3">
                <button type="button" onClick={() => guardedNavigate("/profile")} className="flex items-center gap-3 flex-1 bg-transparent cursor-pointer text-left">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden bg-muted ring-1 ring-border/20 shadow-sm">
                    {localProfileImage ? (
                      <img src={localProfileImage} alt="Profile photo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center">{getInitials(userName || username || "Anonymous")}</div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{username || userName || "Anonymous"}</span>
                  </div>
                </button>
                {!adminLoading && isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); guardedNavigate("/admin"); }}
                    className="p-2 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none transition-all duration-200 ease-in-out"
                    aria-label="Backoffice"
                    title="Backoffice"
                  >
                    <Icon name="shieldCheck" className="w-6 h-6 cursor-pointer" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleNavItemClick(e, "/settings")}
                  className="p-2 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none transition-all duration-300 ease-in-out hover:scale-110 hover:rotate-90"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Icon name="gear" className="w-6 h-6 cursor-pointer" />
                </button>
              </div>
                </>
              ) : (
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Link
                    href="/support"
                    onClick={(e) => handleNavItemClick(e, "/support")}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 ease-in-out"
                  >
                    Need help?
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => handleNavItemClick(e, "/settings")}
                    className="p-2 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none transition-all duration-300 ease-in-out hover:scale-110 hover:rotate-90"
                    aria-label="Settings"
                    title="Settings"
                  >
                    <Icon name="gear" className="w-6 h-6 cursor-pointer" />
                  </button>
                </div>
              )}
              <Button onClick={handleLogout} className="w-full py-2" variant="primary">{isLoggedIn ? "Log out" : "Log in"}</Button>
            </div>
          </div>
        </div>
      )}

      {showNotifications && (
        <div className="md:hidden fixed right-0 top-0 z-50">
          <NotificationOverlay isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>
      )}

      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-background border-r-2 border-border/50 z-30">
        <div className="px-4 py-3 pt-10 flex justify-center">
          <button type="button" onClick={() => guardedNavigate("/app")} className="inline-flex items-center cursor-pointer" aria-label="Home">
            <Logo width={160} height={40} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <Input className="flex-1" placeholder="Search..." value={searchQuery} onChange={handleSearchChange} onKeyDown={handleDesktopSearchKeyDown} />
              <button
                type="button"
                onClick={() => setShowFiltersModal(true)}
                className={`inline-flex items-center justify-center h-10 w-10 rounded-md border border-border transition-colors ${hasActiveFilters ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent/20"}`}
                aria-pressed={hasActiveFilters}
                aria-label="Open filters"
                title="Filter notes"
              >
                <Icon name="filter" className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            {items.filter((item) => item.name !== "Support").map((item) => (
              item.onClick ? (
                <button key={item.href} onClick={(e) => { e.preventDefault(); item.onClick?.(e); }} className={`w-full flex items-center gap-3 p-3 rounded-sm hover:bg-accent/20 text-foreground cursor-pointer transition-colors duration-200 ease-in-out ${pathname === item.href || (item.name === 'Notifications' && showNotifications) ? 'bg-accent' : ''}`}>
                  <div className="relative flex items-center">
                    <BadgeIcon name={item.icon} count={item.name === "Notifications" ? item.unreadNotifications ?? undefined : undefined} className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-sm">{item.name}</span>
                </button>
              ) : (
                <Link key={item.href} href={item.href} onClick={(e) => handleNavItemClick(e, item.href)} className={`flex items-center gap-2 p-3 rounded-sm hover:bg-accent/20 text-foreground cursor-pointer transition-colors duration-200 ease-in-out ${pathname === item.href || (item.name === 'Notifications' && showNotifications) ? 'bg-accent' : ''}`}>
                  <div className="relative flex items-center">
                    <BadgeIcon name={item.icon} count={item.name === "Notifications" ? item.unreadNotifications ?? undefined : undefined} className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-sm">{item.name}</span>
                </Link>
              )
            ))}
          </div>
        </nav>
        <div className="p-4 space-y-3">
          {mounted && isLoggedIn ? (
            <>
              <Link
                href="/support"
                onClick={(e) => handleNavItemClick(e, "/support")}
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 ease-in-out"
              >
                Need help?
              </Link>
              <div className="flex items-center gap-3 border-t border-border pt-3">
                <button type="button" onClick={() => guardedNavigate("/profile")} className="flex items-center gap-3 flex-1 bg-transparent cursor-pointer text-left">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden bg-muted ring-1 ring-border/20 shadow-sm">
                    {localProfileImage ? (
                      <img src={localProfileImage} alt="Profile photo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center">{getInitials(userName || username || "Anonymous")}</div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{username || userName || "Anonymous"}</span>
                  </div>
                </button>
                {!adminLoading && isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); guardedNavigate("/admin"); }}
                    className="p-2 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none transition-all duration-200 ease-in-out"
                    aria-label="Backoffice"
                    title="Backoffice"
                  >
                    <Icon name="shieldCheck" className="w-6 h-6 cursor-pointer" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleNavItemClick(e, "/settings")}
                  className="p-2 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none transition-all hover:scale-110 hover:rotate-90"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Icon name="gear" className="w-6 h-6 cursor-pointer" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between border-t border-border pt-3">
              <Link
                href="/support"
                onClick={(e) => handleNavItemClick(e, "/support")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 ease-in-out"
              >
                Need help?
              </Link>
              <button
                type="button"
                onClick={(e) => handleNavItemClick(e, "/settings")}
                className="p-2 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none transition-all hover:scale-110 hover:rotate-90"
                aria-label="Settings"
                title="Settings"
              >
                <Icon name="gear" className="w-6 h-6 cursor-pointer" />
              </button>
            </div>
          )}
          <Button onClick={handleLogout} variant="primary" className="w-full">{isLoggedIn ? "Log out" : "Log in"}</Button>
        </div>
      </aside>
      <div className="hidden md:block md:fixed md:left-[16rem] md:top-0 z-40">
        <NotificationOverlay isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
      </div>

      <LoginRequiredModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} message="You must be logged in to access shared notes." />
      <NotesFilterModal isOpen={showFiltersModal} onClose={() => setShowFiltersModal(false)} />
    </>
  );
}

function getPageTitle(pathname: string | null, items: NavItem[]): string {
  if (!pathname) return "Notus";
  const found = items.find((i) => i.href === pathname);
  if (found) return found.name;
  if (pathname === "/") return "My notes";
  if (pathname === "/profile") return "My account";
  if (pathname === "/settings") return "Settings";
  if (pathname === "/favorites") return "Favorites";
  if (pathname === "/folders") return "Folders";
  if (pathname.startsWith("/folders/")) return "Folder";
  if (pathname === "/support") return "Support";
  if (pathname === "/trash") return "Trash";
  if (pathname.startsWith("/profile/edit")) return "Edit profile";
  return "Notus";
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}


