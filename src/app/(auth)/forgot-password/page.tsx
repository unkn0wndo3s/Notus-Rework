"use client";

import { useActionState } from "react";
import { sendPasswordResetEmailAction } from "@/lib/actions";
import Link from "next/link";
import { Button, Input, Card, Alert } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [message, formAction, isPending] = useActionState(
    sendPasswordResetEmailAction,
    undefined
  );

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <Card.Header className="text-center">
          <Card.Title className="text-3xl mb-2">Forgot password</Card.Title>
          <Card.Description>
            Enter your email to receive a reset link
          </Card.Description>
        </Card.Header>

        <Card.Content>
          <form action={formAction} className="space-y-6">
            {/* Email */}
            <Input
              label="Email address"
              type="email"
              id="email"
              name="email"
              required
              placeholder="your@email.com"
            />

            {/* Success/error message */}
            {message && (
              <Alert
                variant={
                  message.toLowerCase().includes("sent") || message.toLowerCase().includes("successful")
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
                ? "Sending..."
                : "Send reset link"}
            </Button>
          </form>
        </Card.Content>

        <Card.Footer className="text-center">
          <p className="text-foreground py-3">
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

