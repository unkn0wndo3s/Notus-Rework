"use client";

import { checkDeletedAccountAction, reactivateAccountAction } from "@/actions/userActions";

import { signIn } from "next-auth/react";
import Link from "next/link";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useLocalSession } from "@/hooks/useLocalSession";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Button,
  Input,
  Card,
  LoadingSpinner,
  Logo,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui";

interface LoginPageClientProps {
  serverSession: any;
}

function LoginPageClient({ serverSession }: Readonly<LoginPageClientProps>) {
  const { isLoggedIn, loading } = useLocalSession(serverSession);
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [password, setPassword] = useState("");
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateEmail, setReactivateEmail] = useState("");
  const [reactivateExpiresAt, setReactivateExpiresAt] = useState<string | null>(null);
  const [reactivateError, setReactivateError] = useState("");

  // Clear only the password on auth error
  useEffect(() => {
    if (errorMessage) {
      setPassword("");
    }
  }, [errorMessage]);

  // Redirection if already logged in
  useEffect(() => {
    if (!loading && isLoggedIn) {
      router.push("/app");
    }
  }, [isLoggedIn, loading, router]);

  // Display loading during verification
  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <LoadingSpinner.Card
          message="Checking session..."
          className="max-w-md w-full"
        />
      </main>
    );
  }

  // Do not show the form if already logged in
  if (isLoggedIn) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <Card.Header className="text-center">
          <Logo />
          <Card.Title className="text-4xl mb-2 font-light">
            Login
          </Card.Title>
        </Card.Header>

        <Card.Content>
          {/* Google Button */}
          <div className="mb-6">
            <GoogleSignInButton text="Sign in with Google" />
          </div>

          {/* Separator */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <form
            className="space-y-6 mb-0"
            onSubmit={async (e) => {
              e.preventDefault();
              setErrorMessage("");
              setIsPending(true);
              try {
                const formData = new FormData(e.currentTarget);
                const email = (formData.get("email") || "").toString();
                const passwordValue = (
                  formData.get("password") || ""
                ).toString();

                if (!email || !passwordValue) {
                  setErrorMessage(
                    "Please enter your identifier and password."
                  );
                  setIsPending(false);
                  return;
                }

                // 1) Check if account is deleted but restorable
                try {
                  const data = await checkDeletedAccountAction(email);
                  if (data.success && data.found) {
                    if (data.expired) {
                      setErrorMessage(
                        "This account has been deleted and the restoration period has expired."
                      );
                      setIsPending(false);
                      return;
                    }
                    // Prompt to reactivate
                    setReactivateEmail(email);
                    setReactivateExpiresAt(data.expiresAt || null);
                    setReactivateError("");
                    setReactivateOpen(true);
                    setIsPending(false);
                    return;
                  }
                } catch (_) {}

                // 2) Proceed with normal sign-in
                const result = await signIn("credentials", {
                  redirect: false,
                  callbackUrl: "/",
                  email,
                  password: passwordValue,
                });

                if (result?.ok && !result.error) {
                  router.push("/app");
                } else {
                  setErrorMessage(
                    "Incorrect email or password, or email not verified."
                  );
                }
              } catch (err) {
                setErrorMessage("An error occurred.");
              } finally {
                setIsPending(false);
              }
            }}
          >
            {/* Email/Pseudo */}
            <Input
              label="Email"
              type="text"
              id="email"
              name="email"
              required
              placeholder="your@email.com"
            />

            {/* Password */}
            <div className="mb-0">
              <div className="flex justify-between items-center mb-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                id="password"
                name="password"
                required
                minLength={6}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errorMessage || undefined}
                enablePasswordToggle
              />
            </div>
            <Card.Footer className="text-center">
              <div className="text-muted-foreground py-4">
                Don't have an account?{" "}
                <Button variant="link" asChild className="p-0 h-auto">
                  <Link
                    className="text-primary"
                    href="/register"
                  >
                    Register
                  </Link>
                </Button>
              </div>
            </Card.Footer>
            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending}
              loading={isPending}
              className="w-full"
            >
              {isPending ? "Logging in..." : "Login"}
            </Button>
          </form>
        </Card.Content>
        <Card.Footer className="text-center p-2">
          <Link href="/app" className="text-muted-foreground">
            Continue as guest
          </Link>
        </Card.Footer>
      </Card>
      {/* Reactivation dialog */}
      <Dialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Reactivate your account?</DialogTitle>
            <DialogDescription>
              Your account associated with {reactivateEmail} was deleted, but can
              still be restored{reactivateExpiresAt ? ` until ${new Date(reactivateExpiresAt).toLocaleDateString()}` : ""}.
              Confirm to reactivate it.
            </DialogDescription>
          </DialogHeader>
          {reactivateError ? (
            <div className="text-destructive text-sm">{reactivateError}</div>
          ) : null}
          <DialogFooter>
            <Button
              className="px-6 py-2"
              variant="secondary"
              onClick={() => {
                setReactivateOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="px-6 py-2"
              variant="primary"
              onClick={async () => {
                setReactivateError("");
                try {
                  const data = await reactivateAccountAction(reactivateEmail, password);
                  if (!data.success) {
                    setReactivateError(data.error || "Unable to reactivate account.");
                    return;
                  }
                  // After restore, sign-in directly
                  const result = await signIn("credentials", {
                    redirect: false,
                    callbackUrl: "/app",
                    email: reactivateEmail,
                    password,
                  });
                  if (result?.ok && !result.error) {
                    setReactivateOpen(false);
                    router.push("/app");
                  } else {
                    setReactivateError("Reactivation succeeded, but login failed.");
                  }
                } catch (e) {
                  setReactivateError("Internal error. Please try again.");
                }
              }}
            >
              Reactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function LoginPage() {
  return <LoginPageClient serverSession={null} />;
}
