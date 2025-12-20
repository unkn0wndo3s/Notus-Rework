"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { clearUserSession } from "@/lib/session-utils";
import BannedUserModal from "@/components/auth/BannedUserModal";

interface UserStatusGuardProps {
  children: React.ReactNode;
}

export default function UserStatusGuard({ children }: Readonly<UserStatusGuardProps>) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [showBannedModal, setShowBannedModal] = useState(false);
  const [banReason, setBanReason] = useState<string>("");
  const [hasShownModal, setHasShownModal] = useState(false);

  useEffect(() => {
    if (status === "loading") return; // Wait for the session to be loaded

    // If user is not logged in, clear their userSession
    if (status === "unauthenticated") {
      if (globalThis.window !== undefined) {
        const userSession = globalThis.window.localStorage.getItem("userSession");
        if (userSession) {
          console.log("🧹 Unauthenticated user detected, clearing userSession...");
          clearUserSession();
        }
      }
      return;
    }

    // Check if user is logged in and banned
    if (session?.user?.isBanned && !hasShownModal) {
      // Immediately disconnect banned user
      const handleBannedUser = async () => {
        try {
          // Remove session from localStorage and sessionStorage
          clearUserSession();
          
          // Verify that localStorage is cleared
          if (globalThis.window !== undefined) {
            const userSession = globalThis.window.localStorage.getItem("userSession");
            const currentUserId = globalThis.window.localStorage.getItem("currentUserId");
            console.log("🧹 Clearing localStorage - userSession:", userSession ? "present" : "removed");
            console.log("🧹 Clearing localStorage - currentUserId:", currentUserId ? "present" : "removed");
            
            if (userSession) {
              console.log("⚠️ userSession still present, forcing removal...");
              globalThis.window.localStorage.removeItem("userSession");
            }
            if (currentUserId) {
              console.log("⚠️ currentUserId still present, forcing removal...");
              globalThis.window.localStorage.removeItem("currentUserId");
            }
          }
          
          // Disconnect the user
          await signOut({ redirect: false });
          
          // Show notification modal
          setBanReason("Your account has been suspended by an administrator.");
          setShowBannedModal(true);
          setHasShownModal(true);
        } catch (error) {
          console.error("Error during banned user logout:", error);
          setBanReason("Your account has been suspended by an administrator.");
          setShowBannedModal(true);
          setHasShownModal(true);
        }
      };
      
      handleBannedUser();
      return;
    }

    // If user is not banned but tries to access /banned, redirect to application
    if (pathname === "/banned" && session?.user && !session.user.isBanned) {
      router.push("/app");
    }
  }, [session, status, pathname, router, hasShownModal]);

  // If user is banned, show modal
  if (showBannedModal) {
    return (
      <BannedUserModal
        isOpen={showBannedModal}
        onClose={() => {
          setShowBannedModal(false);
          // Redirect to landing page after closing modal
          router.push("/");
        }}
        reason={banReason}
      />
    );
  }

  // Otherwise, show normal content
  return <>{children}</>;
}
