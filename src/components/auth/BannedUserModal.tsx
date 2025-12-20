"use client";

import { useEffect } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import Icon from "@/components/Icon";

interface BannedUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export default function BannedUserModal({
  isOpen,
  onClose,
  reason = "Your account has been suspended by an administrator.",
}: BannedUserModalProps) {

  // Auto-redirection after 5 seconds if the user does not close the modal
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Account Suspended"
      size="md"
    >
      <Modal.Content>
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <Icon name="alert" className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Access Suspended
            </h3>
            <p className="text-muted-foreground mb-4">
              {reason}
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive">
                You have been automatically logged out. You will be redirected to the home page in a few seconds.
              </p>
            </div>
          </div>
        </div>
      </Modal.Content>
      <Modal.Footer>
        <Button
          variant="ghost"
          className="cursor-pointer px-6 py-2"
          onClick={onClose}
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}


