"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui";
import Icon from "@/components/Icon";

interface GoogleSignInButtonProps {
  text?: string;
}

export default function GoogleSignInButton({
  text = "Sign in with Google",
}: Readonly<GoogleSignInButtonProps>) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await signIn("google", {
        callbackUrl: "/app",
        redirect: true,
      });
    } catch (error) {
      console.error("Google sign in error:", error);
      setError("Error signing in with Google. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        loading={isLoading}
        variant="outline"
        className="w-full flex items-center justify-center px-4 py-3 border border-input rounded-lg shadow-sm bg-background text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Icon name="google" className="w-5 h-5" />
        <span>{text}</span>
      </Button>

      {error && (
        <div className="mt-3 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
