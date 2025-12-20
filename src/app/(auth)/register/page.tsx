"use client";

import { useActionState, useState, useMemo, useEffect } from "react";
import { registerUser } from "@/actions/userActions";
import Link from "next/link";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useLocalSession } from "@/hooks/useLocalSession";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Card,
  Alert,
  LoadingSpinner,
  Logo,
  StatusCircle,
} from "@/components/ui";

interface RegisterPageClientProps {
  serverSession: any;
}

function RegisterPageClient({ serverSession }: RegisterPageClientProps) {
  const { isLoggedIn, loading } = useLocalSession(serverSession);
  const router = useRouter();
  const [message, formAction, isPending] = useActionState(
    registerUser,
    undefined
  );

  // Real-time validation
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const validFirstName = firstName.trim().length >= 4; // > 3
  const validLastName = lastName.trim().length >= 4; // > 3
  const validUsername = username.trim().length >= 4; // > 3
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const validEmail = emailRegex.test(email);
  const passMin = password.length >= 8;
  const passUpper = /[A-Z]/.test(password);
  const passLower = /[a-z]/.test(password);
  const passDigit = /\d/.test(password);
  const passSpecial = /[^A-Za-z0-9]/.test(password);
  const validPassword =
    passMin && passUpper && passLower && passDigit && passSpecial;
  const validConfirm = confirmPassword === password && password.length > 0;
  const allValid =
    validFirstName &&
    validLastName &&
    validUsername &&
    validEmail &&
    validPassword &&
    validConfirm &&
    acceptTerms;

  // Password progress indicators
  const passwordRemaining = useMemo(() => {
    const items: string[] = [];
    if (!passMin) items.push("At least 8 characters");
    if (!passUpper) items.push("One uppercase letter");
    if (!passLower) items.push("One lowercase letter");
    if (!passDigit) items.push("One number");
    if (!passSpecial) items.push("One special character");
    return items;
  }, [passMin, passUpper, passLower, passDigit, passSpecial]);

  const passwordSatisfied = 5 - passwordRemaining.length;
  const passwordProgress = Math.round((passwordSatisfied / 5) * 100);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && isLoggedIn) {
      router.push("/app");
    }
  }, [isLoggedIn, loading, router]);

  // Show loading while verifying
  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <LoadingSpinner.Card
          message="Verifying..."
          className="max-w-md w-full"
        />
      </main>
    );
  }

  // Do not show form if already logged in
  if (isLoggedIn) {
    return null;
  }

  if (message && message.includes("successful")) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <StatusCircle variant="success" className="mb-6" label="Registration successful">
            <span className="text-2xl">✓</span>
          </StatusCircle>
          <Card.Title className="text-2xl mb-4">
            Registration successful!
          </Card.Title>
          <Card.Description className="mb-6">
            A verification email has been sent to your email address.
            Please click the link in the email to activate your account.
          </Card.Description>
          <Button asChild>
            <Link href="/login">Login</Link>
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <Card.Header className="text-center">
          <Logo />
          <Card.Title className="text-3xl mb-2">Create an account</Card.Title>
          <Card.Description>Join our community</Card.Description>
        </Card.Header>

        {/* Google Button */}
        <div className="mb-6">
          <GoogleSignInButton text="Sign up with Google" />
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

        <Card.Content>
          <form action={formAction} className="space-y-6">
            {/* First and Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name *"
                type="text"
                id="firstName"
                name="firstName"
                required
                minLength={4}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
              />

              <Input
                label="Last Name *"
                type="text"
                id="lastName"
                name="lastName"
                required
                minLength={4}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Your last name"
              />
            </div>

            {/* Email */}
            <Input
              label="Email *"
              type="email"
              id="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />

            {/* Username */}
            <Input
              label="Username *"
              type="text"
              id="username"
              name="username"
              required
              minLength={4}
              pattern="[a-zA-Z0-9_]+"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
            />

            {/* Password */}
            <Input
              label="Password *"
              type="password"
              id="password"
              name="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              enablePasswordToggle
            />

            {/* Password requirements indicator */}
            <div className="-mt-4">
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`bg-primary h-full transition-all duration-300`}
                  style={{
                    width: `${passwordProgress}%`,
                    opacity: Math.max(0.2, passwordProgress / 100),
                  }}
                />
              </div>
              {passwordRemaining.length > 0 && (
                <ul className="mt-2 text-xs text-muted-foreground list-disc pl-5 space-y-1">
                  {passwordRemaining.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Password confirmation */}
            <Input
              label="Confirm Password *"
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              error={
                confirmPassword && confirmPassword !== password
                  ? "Passwords do not match"
                  : undefined
              }
              enablePasswordToggle
            />

            {/* Terms of use acceptance */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="acceptTerms"
                  name="acceptTerms"
                  type="checkbox"
                  required
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className={`h-5 w-5 border-2 rounded transition-all duration-200 cursor-pointer appearance-none ${
                    acceptTerms 
                      ? "border-primary bg-primary" 
                      : "border-input bg-background"
                  }`}
                  style={{
                    backgroundImage: acceptTerms ? `url("data:image/svg+xml,%3csvg viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M5 13l4 4L19 7'/%3e%3c/svg%3e")` : 'none',
                    backgroundSize: '16px',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                />
              </div>
              <div className="ml-3 text-sm">
                <label
                  htmlFor="acceptTerms"
                  className="text-muted-foreground"
                >
                  I confirm that I have read and accepted the{" "}
                  <Link
                    href="/legal/cgu"
                    target="_blank"
                    className="text-primary hover:text-primary/90 underline"
                  >
                    terms of use
                  </Link>{" "}
                  and the{" "}
                  <Link
                    href="/legal/rgpd"
                    target="_blank"
                    className="text-primary hover:text-primary/90 underline"
                  >
                    GDPR legal notice
                  </Link>
                  . *
                </label>
              </div>
            </div>

            {/* Error message */}
            {message && !message.includes("successful") && (
              <Alert variant="error">
                <Alert.Description>{message}</Alert.Description>
              </Alert>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isPending || !allValid}
              loading={isPending}
              className="w-full"
              size="lg"
            >
              {isPending ? "Creating account..." : "Create my account"}
            </Button>
          </form>
        </Card.Content>

        <Card.Footer className="text-center">
          <p className="text-muted-foreground">
            Already have an account?{" "}
            <Button variant="link" asChild>
              <Link className="text-primary" href="/login">
                Login
              </Link>
            </Button>
          </p>
        </Card.Footer>
      </Card>
    </main>
  );
}

export default function RegisterPage() {
  return <RegisterPageClient serverSession={null} />;
}

