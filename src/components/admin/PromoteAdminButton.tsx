"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { promoteSelfAction } from "@/actions/adminActions";

export default function PromoteAdminButton() {
  const [isPromoting, setIsPromoting] = useState(false);

  const handlePromoteToAdmin = async () => {
    if (!globalThis.window.confirm("Are you sure you want to promote yourself to administrator?")) {
      return;
    }

    setIsPromoting(true);

    try {
      const result = await promoteSelfAction();

      if (result.success) {
        globalThis.window.alert(
          "You have been promoted to administrator! Reload the page to see the changes."
        );
        globalThis.window.location.reload();
      } else {
        globalThis.window.alert(`Error: ${result.error}`);
      }
    } catch (error) {
      globalThis.window.alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <button
      onClick={handlePromoteToAdmin}
      disabled={isPromoting}
      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isPromoting ? (
        <Icon name="spinner" className="animate-spin -ml-1 mr-2 h-3 w-3" />
      ) : (
        <Icon name="shieldCheck" className="w-3 h-3 mr-1" />
      )}
      {isPromoting ? "Promoting..." : "Become Admin"}
    </button>
  );
}


