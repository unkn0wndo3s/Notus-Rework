"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { checkAdminStatus } from "@/actions/userActions";

export default function AdminButton() {
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

  if (loading) {
    return null;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Link
      href="/admin"
      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
    >
      <Icon name="shieldCheck" className="w-4 h-4 mr-2" />
      Backoffice
    </Link>
  );
}


