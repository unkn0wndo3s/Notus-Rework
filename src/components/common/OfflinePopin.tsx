"use client";

import React, { useEffect, useState, useCallback } from "react";
import Alert from "@/components/ui/alert";
import { XIcon, WifiOff } from "lucide-react";
import { usePathname } from "next/navigation";

export default function OfflinePopin() {
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);
  const [forceShow, setForceShow] = useState<boolean>(false);
  const pathname = usePathname();
  const isEditingDocument = /^\/documents\/(\d+)/.test(pathname || "");

  const handleOnline = useCallback(() => {
    console.log(`[OfflinePopin] 'online' event detected`);
    setIsOffline(false);
    setIsDismissed(false);
    // Hide any offline popin shown during reconnection
    setForceShow(false);
    setOverrideMessage(null);
  }, []);

  const handleOffline = useCallback(() => {
    console.log(`[OfflinePopin] 'offline' event detected`);
    setIsOffline(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const initialOffline = !navigator.onLine;
    console.log(`[OfflinePopin] Initial state: ${initialOffline ? "offline" : "online"}`);
    setIsOffline(initialOffline);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Listen for global requests to show an offline message (e.g., before guarded navigations)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ message?: string; durationMs?: number }>;
      const message = custom.detail?.message || null;
      console.log(`[OfflinePopin] Event received - message: "${message}"`);
      setOverrideMessage(message);
      setIsDismissed(false);
      setForceShow(true);
      setIsOffline(true);
    };
    window.addEventListener("notus:offline-popin", handler as EventListener);
    return () => {
      window.removeEventListener("notus:offline-popin", handler as EventListener);
    };
  }, []);

  // Poll every 5s when on a document page to verify connectivity via navigator.onLine (no HTTP request)
  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    const match = pathname?.match(/^\/documents\/(\d+)/);
    const documentId = match?.[1] || null;
    if (!documentId) return;

    let cancelled = false;

    const checkConnection = () => {
      const online = navigator.onLine;
      console.log(`[OfflinePopin] Local check for document ${documentId}: ${online ? "online" : "offline"}`);
      if (cancelled) return;
      setIsOffline((previous) => {
        const next = !online;
        return previous !== next ? next : previous;
      });
      if (online) {
        // Hide popin if connection is restored via polling
        setForceShow(false);
        setOverrideMessage(null);
      }
    };

    checkConnection();
    const intervalId = window.setInterval(checkConnection, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pathname]);

  if (!(isOffline || forceShow) || isDismissed) return null;

  return (
    <div className="fixed left-4 bottom-4 z-50 max-w-sm animate-slide-up">
      <Alert variant="error" className="shadow-lg flex items-start gap-3 pr-10 bg-card">
        <div className="mt-0.5 text-destructive">
          <WifiOff className="h-5 w-5" />
        </div>
        <div>
          <h4 className="font-semibold mb-1">You are offline</h4>
          <p className="text-sm leading-5">
            {overrideMessage || (isEditingDocument
              ? "Your connection seems interrupted. Changes made will be saved if you are the only one making them, otherwise they will be overwritten."
              : "Your internet connection seems interrupted. You will be able to access the various features once the connection is restored.")}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close offline alert"
          className="absolute top-2 right-2 rounded-xs p-1 text-destructive/80 hover:text-destructive focus:outline-hidden focus:ring-2 focus:ring-ring"
          onClick={() => setIsDismissed(true)}
        >
          <XIcon className="h-4 w-4" />
        </button>
      </Alert>
    </div>
  );
}
