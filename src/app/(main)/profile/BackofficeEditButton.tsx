"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";
import { checkAdminStatus } from "@/actions/userActions";

export default function BackofficeEditButton() {
  const { guardedNavigate } = useGuardedNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const result = await checkAdminStatus();
        setIsAdmin(!!(result.success && result.isAdmin));
      } catch (error) {
        console.error("Error checking admin status:", error);
      } finally {
        setLoading(false);
      }
    };

    verifyAdmin();
  }, []);

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <Button className="px-4 py-2" variant="secondary" onClick={() => guardedNavigate("/admin")}>
      Backoffice
    </Button>
  );
}


