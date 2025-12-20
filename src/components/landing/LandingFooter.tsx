import Link from "next/link";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/logo";

interface LandingFooterProps {
  isLoggedIn: boolean;
}

export default function LandingFooter({ isLoggedIn }: Readonly<LandingFooterProps>) {
  return (
    <footer className={cn("border-t border-border bg-card/50 py-12")}>
      <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8")}>
        <div
          className={cn(
            "mb-8 grid grid-cols-1 gap-8 md:grid-cols-3",
            "text-center md:text-left"
          )}
        >
          <section className={cn("space-y-4")}>
            <Logo className={cn("mx-auto md:mx-0")} />
            <p className={cn("text-muted-foreground text-center md:text-left md:pl-4")}>
              Your collaborative workspace to create, organize and share your documents.
            </p>
          </section>

          <section>
            <h3 className={cn("font-title text-lg font-bold text-foreground mb-4")}>Legal</h3>
            <ul className={cn("flex flex-col items-center space-y-2 md:items-start")}>
              <li>
                <Link
                  href="/legal/cgu"
                  className={cn("text-muted-foreground transition-colors hover:text-foreground")}
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/rgpd"
                  className={cn("text-muted-foreground transition-colors hover:text-foreground")}
                >
                  GDPR Legal Notice
                </Link>
              </li>
            </ul>
          </section>

          <section>
            <h3 className={cn("font-title text-lg font-bold text-foreground mb-4")}>Navigation</h3>
            <ul className={cn("flex flex-col items-center space-y-2 md:items-start")}>
              {isLoggedIn ? (
                <li>
                  <Link
                    href="/app"
                    className={cn("text-muted-foreground transition-colors hover:text-foreground")}
                  >
                    My documents
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link
                      href="/login"
                      className={cn("text-muted-foreground transition-colors hover:text-foreground")}
                    >
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/register"
                      className={cn("text-muted-foreground transition-colors hover:text-foreground")}
                    >
                      Sign Up
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </section>
        </div>
        <p className={cn("border-t border-border pt-8 text-center text-sm text-muted-foreground")}>
          © {new Date().getFullYear()} Notus. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
