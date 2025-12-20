import Link from "next/link";
import Icon from "@/components/Icon";

export const metadata = {
  title: "Account Banned - Notus",
  description: "Your account has been banned",
};

export default function BannedPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <section className="max-w-md w-full space-y-8">
        <header className="text-center">
          <div className="mx-auto h-16 w-16 text-destructive">
            <Icon name="alert" className="w-full h-full" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            Account Banned
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account has been suspended by an administrator.
          </p>
        </header>

        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Icon name="alert" className="h-5 w-5 text-destructive" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-destructive">
                Access Denied
              </h3>
              <div className="mt-2 text-sm text-destructive">
                <p>
                  You can no longer access this application. If you
                  think this is an error, please contact an administrator.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/app"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
