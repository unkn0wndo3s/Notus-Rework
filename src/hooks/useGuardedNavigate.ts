"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { checkConnectivityAction } from "@/actions/userActions";

export function useGuardedNavigate() {
  const router = useRouter();
  const pathname = usePathname();

  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = globalThis.window.setTimeout(() => controller.abort(), 5000);
      console.log(`[GuardedNavigate] Checking connectivity...`);
      const result = await checkConnectivityAction();
      globalThis.window.clearTimeout(timeoutId);
      console.log(`[GuardedNavigate] Check response: ${result.success ? "OK" : "FAIL"}`);
      if (!result.success) {
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
      return result.success;
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
