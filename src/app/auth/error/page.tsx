"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, Button, Alert } from "@/components/ui";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to log in.",
  Verification: "The verification token has expired or has already been used.",
  Default: "An unexpected error occurred.",
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  const getErrorMessage = (error: string | null): string => {
    if (!error) return errorMessages.Default;
    return errorMessages[error] || errorMessages.Default;
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <Card.Header className="text-center">
          <Card.Title className="text-2xl mb-4 text-destructive">
            Authentication Error
          </Card.Title>
        </Card.Header>

        <Card.Content className="space-y-4">
          <Alert variant="error">
            {getErrorMessage(error || null)}
          </Alert>

          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Please try again or contact support if the problem persists.
            </p>
          </div>
        </Card.Content>

        <Card.Footer className="flex flex-col space-y-2">
          <Button asChild className="w-full">
            <Link href="/login">
              Back to Login
            </Link>
          </Button>

          <Button variant="outline" asChild className="w-full">
            <Link href="/app">
              Back to Home
            </Link>
          </Button>
        </Card.Footer>
      </Card>
    </main>
  );
}
