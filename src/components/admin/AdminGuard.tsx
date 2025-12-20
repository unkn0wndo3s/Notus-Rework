"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BannedUserModal from "@/components/auth/BannedUserModal";

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: Readonly<AdminGuardProps>) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showBannedModal, setShowBannedModal] = useState(false);
  const [banReason, setBanReason] = useState<string>("");

  useEffect(() => {
    if (status === "loading") return; // Wait for the session to be loaded

    if (!session?.user) {
      // User not logged in, redirect to login page
      router.push("/login");
      return;
    }

    // Check if user is banned
    if (session.user.isBanned) {
      setBanReason("Your account has been suspended by an administrator.");
      setShowBannedModal(true);
      return;
    }

    // Check if user is admin
    if (!session.user.isAdmin) {
      // User logged in but not admin, redirect to application
      router.push("/app");
    }
  }, [session, status, router]);

  // Show loader during verification
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is banned, show modal
  if (showBannedModal) {
    return (
      <BannedUserModal
        isOpen={showBannedModal}
        onClose={() => setShowBannedModal(false)}
        reason={banReason}
      />
    );
  }

  // If user is not admin or not logged in, show nothing
  if (!session?.user?.isAdmin) {
    return null;
  }

  // Admin user logged in, show content
  return <>{children}</>;
}
