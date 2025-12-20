"use client";

import { useActionState, useEffect } from "react";
import { resetPasswordAction } from "@/actions/userActions";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Input, Card, Alert } from "@/components/ui";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");

  const [message, formAction, isPending] = useActionState(
    resetPasswordAction,
    undefined
  );

  useEffect(() => {
    if (
      message &&
      (message.toLowerCase().includes("success") || message.toLowerCase().includes("changed"))
    ) {
      const timer = setTimeout(() => {
        router.push("/login");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [message, router]);

  if (!token) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <Card.Header>
            <Card.Title className="text-3xl mb-4">Invalid token</Card.Title>
            <Card.Description className="mb-6">
              The reset link is invalid or has expired.
            </Card.Description>
          </Card.Header>
          <Card.Footer>
            <Button asChild className="py-2 px-4 text-lg">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </Card.Footer>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <Card.Header className="text-center">
          <Card.Title className="text-3xl mb-2">New password</Card.Title>
          <Card.Description>Enter your new password</Card.Description>
        </Card.Header>

        <Card.Content>
          <form action={formAction} className="space-y-6">
            <input type="hidden" name="token" value={token} />

            {/* New password */}
            <Input
              label="New password"
              type="password"
              id="password"
              name="password"
              required
              minLength={6}
              placeholder="Your new password"
            />

            {/* Password confirmation */}
            <Input
              label="Confirm password"
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={6}
              placeholder="Confirm your new password"
            />

            {/* Success/error message */}
            {message && (
              <Alert
                variant={
                  message.toLowerCase().includes("success") || message.toLowerCase().includes("changed")
                    ? "success"
                    : "error"
                }
              >
                <Alert.Description>{message}</Alert.Description>
              </Alert>
            )}

            {/* Submission button */}
            <Button
              type="submit"
              disabled={isPending}
              loading={isPending}
              className="w-full"
              size="lg"
            >
              {isPending
                ? "Changing..."
                : "Change password"}
            </Button>
          </form>
        </Card.Content>

        <Card.Footer className="text-center">
          <p className="text-foreground">
            Remember your password?{" "}
            <Button variant="link" asChild>
              <Link href="/login">Login</Link>
            </Button>
          </p>
        </Card.Footer>
      </Card>
    </main>
  );
}

