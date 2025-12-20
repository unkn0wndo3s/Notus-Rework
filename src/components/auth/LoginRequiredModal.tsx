"use client";

import Link from "next/link";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import Icon from "@/components/Icon";

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  title?: string;
}

export default function LoginRequiredModal({
  isOpen,
  onClose,
  message = "You must be logged in to perform this action.",
  title = "Authentication Required",
}: Readonly<LoginRequiredModalProps>) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
    >
      <Modal.Content>
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Icon name="lock" className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Restricted Access
            </h3>
            <p className="text-muted-foreground">
              {message}
            </p>
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
        <Button 
          asChild 
          className="cursor-pointer px-6 py-2"
        >
          <Link href="/login">
            Login
          </Link>
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
