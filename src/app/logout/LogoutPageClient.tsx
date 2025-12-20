"use client";

import { signOut } from "next-auth/react";
import { clearUserSession } from "@/lib/session-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Modal } from "@/components/ui";
import Icon from "@/components/Icon";

export default function LogoutPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const immediate = !!(
    searchParams?.get("immediate") === "1" ||
    searchParams?.get("immediate") === "true" ||
    searchParams?.has("auto") ||
    searchParams?.get("source") === "delete"
  );
  const [open, setOpen] = useState(!immediate);

  const handleConfirm = async () => {
    try {
      clearUserSession();
    } catch {}
    await signOut({ callbackUrl: "/", redirect: true });
  };

  const handleCancel = () => {
    setOpen(false);
    router.push("/");
  };

  useEffect(() => {
    if (immediate) {
      (async () => {
        try {
          clearUserSession();
        } catch {}
        await signOut({ callbackUrl: "/", redirect: true });
      })();
    }
  }, [immediate]);

  return (
    <>
      <Modal
        isOpen={open}
        onClose={handleCancel}
        size="sm"
        title="Log out?"
        className="bg-background text-foreground border-2 border-primary text-center text-xl"
      >
        <div className="flex flex-col items-center text-center gap-5 bg-background">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-md">
            <Icon name="logout" className="w-[22px] h-[22px] text-foreground" />
          </div>

          <div className="flex items-center gap-4 mt-2">
            <Button
              variant="primary"
              className="px-6 py-2"
              onClick={handleConfirm}
            >
              Continue
            </Button>
            <Button
              variant="ghost"
              className="px-6 py-2"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

