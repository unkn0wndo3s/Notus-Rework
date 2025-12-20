"use client";

import NavBar from "@/components/navigation/NavBar";
import { deleteAccountAction } from "@/actions/userActions";
import Link from "next/link";
import { Button, Input, Modal } from "@/components/ui";
import Icon from "@/components/Icon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAccountPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    if (successOpen) {
      const t = setTimeout(() => {
        // Redirect to unified logout flow (like the navbar)
        router.push("/logout?immediate=1");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [successOpen, router]);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main>
      {/* Back link */}
      <div className="md:ml-64 md:pl-4 pt-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 pb-4 hidden md:flex gap-4">
          <Link
            href="/profile"
            className="text-foreground font-semibold flex items-center"
          >
            <Icon name="arrowLeft" className="h-6 w-6 mr-2" />
          </Link>
          <h2 className="font-title text-4xl font-regular">Delete Account</h2>
        </div>
      </div>

      {/* Main Content */}
      <div className="md:ml-64 md:pl-4 pt-6">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 pb-10">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Conditions Section */}
            <section>
              <h3 className="text-foreground text-2xl font-title font-bold mb-4">
                Terms:
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                After deleting your account, your data will be kept for 30 days following the activation of your account deletion. Your personal notes will be permanently deleted after this period has passed. You will also be logged out of the application.
              </p>
            </section>

            {/* Delete Account Section */}
            <section>
              <h3 className="text-foreground text-2xl font-title font-bold mb-4">
                Delete Account
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Once you have understood the consequences, if you still want to delete your account, please enter your password. You will then receive a confirmation email. You can reactivate your account within 30 days.
              </p>

              {/* Password Input */}
              <div className="mb-6">
                <label className="text-foreground text-2xl font-title font-bold block mb-2.5">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    className="bg-card text-foreground border-border pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <Icon name="eyeOff" className="h-5 w-5" />
                    ) : (
                      <Icon name="eye" className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Delete Button */}
              <div className="flex flex-col items-center gap-3">
                {!confirmOpen && message && (
                  <p className="text-sm text-muted-foreground text-center max-w-md">{message}</p>
                )}
                <Button
                  variant="danger"
                  className="px-6 py-2"
                  disabled={isLoading}
                  onClick={() => {
                    setMessage(null);
                    if (!password) {
                      setMessage("Please enter your password.");
                      return;
                    }
                    setConfirmOpen(true);
                  }}
                >
                  {isLoading ? "Processing..." : "Delete your account"}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
      </main>
      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title="Confirm deletion?"
        className="bg-background text-foreground border-2 border-primary text-center text-xl"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <p className="text-muted-foreground">
            This action will delete your account. You will be able to reactivate it for 30 days.
          </p>
          {message && (
            <p className="text-sm text-destructive text-center max-w-md">{message}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            <Button
              variant="danger"
              className="px-6 py-2"
              disabled={isLoading}
              onClick={async () => {
                try {
                  setIsLoading(true);
                  setMessage(null);
                  const data = await deleteAccountAction(password);
                  if (!data.success) {
                    setMessage(data.error || "Unable to delete account. Please try again.");
                    return;
                  }
                  setConfirmOpen(false);
                  setSuccessOpen(true);
                } catch (e) {
                  setMessage("An error occurred. Please try again later.");
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              className="px-6 py-2"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        size="sm"
        title="Account Deleted"
        className="bg-background text-foreground border-2 border-primary text-center text-xl"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <p className="text-muted-foreground">
            Account deleted. You will be logged out of the application.
          </p>
        </div>
      </Modal>
    </div>
  );
}
