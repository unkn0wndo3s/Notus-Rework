"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";

export default function BackofficeEditButton() {
  const { guardedNavigate } = useGuardedNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch("/api/admin/check-status");
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
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


