"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

export function useGuardedNavigate() {
  const router = useRouter();
  const pathname = usePathname();

  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = globalThis.window.setTimeout(() => controller.abort(), 5000);
      console.log(`[GuardedNavigate] Checking connectivity...`);
      const resp = await fetch("/api/admin/check-status", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { "cache-control": "no-cache" },
        signal: controller.signal,
      });
      globalThis.window.clearTimeout(timeoutId);
      console.log(`[GuardedNavigate] Check response: ${resp.status} ${resp.ok ? "OK" : "FAIL"}`);
      if (!resp.ok) {
        globalThis.window.dispatchEvent(
          new CustomEvent("notus:offline-popin", {
            detail: {
              message:
                "You will be able to access this feature once connectivity is restored.",
              durationMs: 5000,
            },
          })
        );
      }
      return resp.ok;
    } catch (error) {
      console.log(`[GuardedNavigate] Connectivity check error:`, error);
      globalThis.window.dispatchEvent(
        new CustomEvent("notus:offline-popin", {
          detail: {
            message:
              "You will be able to access this feature once connectivity is restored.",
            durationMs: 5000,
          },
        })
      );
      return false;
    }
  }, []);

  const guardedNavigate = useCallback(async (href: string) => {
    console.log(`[GuardedNavigate] Attempting to navigate to: ${href}`);
      const currentPath = pathname ?? "/";
      const targetPath = href ?? "/";
      if (currentPath === targetPath) {
        console.log(`[GuardedNavigate] Already on ${targetPath}, no action taken.`);
        return;
      }

    const ok = await checkConnectivity();
    if (ok) {
      console.log(`[GuardedNavigate] Connection OK, redirecting to ${href}`);
      router.push(href);
    } else {
      console.log(`[GuardedNavigate] Connection failed, navigation canceled`);
    }
  }, [pathname, router, checkConnectivity]);

  return { guardedNavigate, checkConnectivity };
}
