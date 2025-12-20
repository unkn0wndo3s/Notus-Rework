"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, LoadingSpinner, StatusCircle } from "@/components/ui";
import { verifyEmailAction } from "@/actions/userActions";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token");
      return;
    }

    const verifyEmail = async (token: string) => {
      try {
        const result = await verifyEmailAction(token);

        if (result.success) {
          setStatus("success");
          setMessage(result.message || "Email verified successfully.");
        } else {
          setStatus("error");
          setMessage(result.error || "Error during verification");
        }
      } catch (error) {
        setStatus("error");
        setMessage("Connection error. Please try again.");
      }
    };

    verifyEmail(token);
  }, [token]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <LoadingSpinner.Card
          message="Verifying email..."
          className="max-w-md w-full"
        />
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <Card.Content>
            <StatusCircle variant="success" className="mb-6" label="Email verified">
              <span className="text-2xl">✓</span>
            </StatusCircle>
            <Card.Title className="text-2xl mb-4">Email verified!</Card.Title>
            <Card.Description className="mb-6">
              {message ||
                "Your email address has been successfully verified. You can now log in."}
            </Card.Description>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/login">Login</Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/app">Go to Dashboard</Link>
              </Button>
            </div>
          </Card.Content>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <Card.Content>
          <StatusCircle variant="error" className="mb-6" label="Verification error">
            <span className="text-2xl">✗</span>
          </StatusCircle>
          <Card.Title className="text-2xl mb-4">Verification Error</Card.Title>
          <Card.Description className="mb-6">
            {message ||
              "An error occurred while verifying your email."}
          </Card.Description>
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/register">Try registering again</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/app">Go to Dashboard</Link>
            </Button>
          </div>
        </Card.Content>
      </Card>
    </main>
  );
}
