"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui";

interface NavItem {
  name: string;
  href: string;
  icon: IconName;
}

export default function AdminNavigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation: NavItem[] = [
    { name: "Users", href: "/admin/users", icon: "users" },
    { name: "Requests", href: "/admin/requests", icon: "alert" },
    { name: "Stats", href: "/admin/stats", icon: "chartBar" },
    { name: "Settings", href: "/admin/settings", icon: "gear" },
  ];

  // Close the mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close the mobile menu on click outside (optional)
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("nav")) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <nav className={cn("bg-[var(--background)] border-b border-[var(--border)] shadow-sm")}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link
                href="/admin"
                className={cn(
                  "text-xl font-bold text-[var(--foreground)]",
                  "hover:text-[var(--primary)] transition-colors flex items-center gap-2"
                )}
              >
                <Logo width={160} height={46} />
              </Link>
            </div>
            <div className="hidden min-[1200px]:ml-6 min-[1200px]:flex min-[1200px]:space-x-8">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border-[var(--primary)] text-[var(--foreground)]"
                        : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:text-[var(--foreground)]"
                    )}
                  >
                    <Icon 
                      name={item.icon} 
                      className="w-5 h-5 mr-2" 
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="hidden min-[1200px]:ml-6 min-[1200px]:flex min-[1200px]:items-center">
            <Link
              href="/app"
              className={cn(
                "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                "px-3 py-2 rounded-md text-sm font-medium",
                "transition-colors hover:bg-[var(--muted)]"
              )}
            >
              Back to app
            </Link>
          </div>

          <div className="flex min-[1200px]:hidden items-center">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                "inline-flex items-center justify-center p-2 rounded-md",
                "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                "hover:bg-[var(--muted)]",
                "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--ring)]",
                "transition-colors"
              )}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <Icon name="x" className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Icon name="menu" className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="min-[1200px]:hidden border-t border-[var(--border)] bg-[var(--background)]">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors",
                    isActive
                      ? "bg-[var(--muted)] border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:border-[var(--border)] hover:text-[var(--foreground)]"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="flex items-center">
                    <Icon 
                      name={item.icon} 
                      className="w-5 h-5 mr-3" 
                      aria-hidden="true"
                    />
                    {item.name}
                  </div>
                </Link>
              );
            })}
            <Link
              href="/app"
              className={cn(
                "block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium",
                "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
                "hover:border-[var(--border)] hover:text-[var(--foreground)]",
                "transition-colors"
              )}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div className="flex items-center">
                <Icon 
                  name="home" 
                  className="w-5 h-5 mr-3" 
                  aria-hidden="true"
                />
                Back to app
              </div>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}


