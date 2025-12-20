import "./globals.css";
import FloatingCreateButton from "@/components/documents/FloatingCreateButton";
import AuthSessionProvider from "@/components/auth/SessionProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SelectionProvider } from "@/contexts/SelectionContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ThemeToggle from "@/components/common/ThemeToggle";
import OfflinePopin from "@/components/common/OfflinePopin";
import { SearchProvider } from "@/contexts/SearchContext";
import UserStatusGuard from "@/components/auth/UserStatusGuard";
import DynamicFavicon from "@/components/common/DynamicFavicon";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Metadata } from "next";
import { DrawingsProvider } from "@/contexts/DrawingContext";

export const metadata: Metadata = {
  title: "Notus",
  description: "Notus the bloc note app",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@200..1000&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" >
        <ThemeProvider>
          <DynamicFavicon />
          <AuthSessionProvider session={session}>
            <DrawingsProvider>
              <NotificationProvider>
                <UserStatusGuard>
                  <SearchProvider>
                    <SelectionProvider>
                      <main id="main-content">
                        {children}
                      </main>
                      <FloatingCreateButton serverSession={session} />
                      <ThemeToggle />
                      <OfflinePopin />
                    </SelectionProvider>
                  </SearchProvider>
                </UserStatusGuard>
              </NotificationProvider>
            </DrawingsProvider>
          </AuthSessionProvider>
        </ThemeProvider>

        {/* Footer */}
        {/* <footer className="bg-background border-t border-border">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
                © 2025 Notus. All rights reserved.
              <div className="mt-4 md:mt-0 flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
                <div className="flex space-x-4">
                  <Link
                    href="/legal/rgpd"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    GDPR Legal Mentions
                  </Link>
                  <Link
                    href="/legal/cgu"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    General Terms of Use
                  </Link>
                </div>
                {session?.user && (
                  <div className="mt-2 md:mt-0">
                  </div>
                )}
              </div>
            </div>
          </div>
        </footer> */}
      </body>
    </html>
  );
}

