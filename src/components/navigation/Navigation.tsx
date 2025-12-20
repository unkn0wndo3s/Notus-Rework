"use client";

import Link from "next/link";
import { useLocalSession } from "@/hooks/useLocalSession";
import AdminButton from "@/components/admin/AdminButton";
import type { Session } from "next-auth";

interface NavigationProps {
  serverSession?: Session | null;
}

export default function Navigation({ serverSession }: Readonly<NavigationProps>) {
  const { loading, isLoggedIn, userName } = useLocalSession(serverSession);

  if (loading) {
    return (
      <div className="flex items-center space-x-4">
        <div className="animate-pulse bg-muted h-8 w-20 rounded"></div>
        <div className="animate-pulse bg-muted h-8 w-20 rounded"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center space-x-4">
        <Link href="/register" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
          Sign up
        </Link>
        <Link href="/login" className="border border-border hover:bg-muted text-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <span className="text-foreground">
        Hello, <strong>{userName}</strong>
      </span>
      <AdminButton />
    </div>
  );
}


