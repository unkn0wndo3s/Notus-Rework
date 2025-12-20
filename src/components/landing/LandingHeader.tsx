import Link from "next/link";
import { Button } from "@/components/ui";
import Logo from "@/components/ui/logo";

interface LandingHeaderProps {
  isLoggedIn: boolean;
}

const navItems = [
  { label: "Features", href: "#features" },
  { label: "Process", href: "#process" },
  { label: "Metrics", href: "#metrics" },
  { label: "Reviews", href: "#testimonials" },
];

export default function LandingHeader({ isLoggedIn }: Readonly<LandingHeaderProps>) {
  return (
    <header className="border-b border-border bg-card/70 backdrop-blur-xl sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex items-center justify-between h-16 gap-6">
          <Link href="/" className="flex items-center" aria-label="Notus Home">
            <Logo width={140} height={40} />
          </Link>

          <ul className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Button asChild size="sm" className="text-base px-4 py-2">
                <Link href="/app">Access Application</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="text-base px-4 py-2">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild size="sm" className="text-base px-4 py-2">
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
