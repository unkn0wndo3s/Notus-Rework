"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getUnreadCount } from "@/actions/notificationActions";

type NotificationContextValue = {
  unreadCount: number;
  setUnreadCountSync: (n: number) => void; 
  adjustUnreadCount: (delta: number) => void; 
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    async function fetchCount() {
      if (!session?.user?.id) {
        if (mounted) setUnreadCount(0);
        return;
      }
      try {
        const result = await getUnreadCount();
        if (mounted && result.success && typeof result.data === "number") {
          setUnreadCount(result.data);
        }
      } catch (error) {
        console.error("fetchCount error", error);
      }
    }
    fetchCount();
    return () => { mounted = false; };
  }, [session?.user?.id]);

  const setUnreadCountSync = (n: number) => {
    setUnreadCount(Math.max(0, Math.floor(n || 0)));
  };

  const adjustUnreadCount = (delta: number) => {
    setUnreadCount((prev) => Math.max(0, prev + Math.floor(delta || 0)));
  };

  const refresh = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const result = await getUnreadCount();
      if (result.success && typeof result.data === "number") {
        setUnreadCount(result.data);
      }
    } catch (error) {
      console.error("refresh error", error);
    }
  }, [session?.user?.id]);

  const value = useMemo(() => ({ unreadCount, setUnreadCountSync, adjustUnreadCount, refresh }), [unreadCount, refresh]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used inside NotificationProvider");
  return ctx;
}
