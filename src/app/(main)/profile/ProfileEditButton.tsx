"use client";

import { Button } from "@/components/ui";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";

export default function ProfileEditButton() {
  const { guardedNavigate } = useGuardedNavigate();
  return (
    <Button className="px-4 py-2" onClick={() => guardedNavigate("/profile/edit")}>
      Edit profile
    </Button>
  );
}


