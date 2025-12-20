import Link from "next/link";
import { Button } from "@/components/ui";

interface CTASectionProps {
  isLoggedIn: boolean;
}

export default function CTASection({ isLoggedIn }: Readonly<CTASectionProps>) {
  return (
    <section className="py-20 bg-primary/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-title text-4xl sm:text-5xl font-bold text-foreground mb-6">
          Ready to structure your knowledge?
        </h2>
        <p className="text-xl text-muted-foreground mb-10">
          Notus connects in minutes to your organization. No complex deployment required.
        </p>
        {isLoggedIn ? (
          <Button asChild size="lg" className="text-lg px-4 py-2">
            <Link href="/app">Access application</Link>
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-4 py-2">
              <Link href="/register">Create free account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-4 py-2">
              <Link href="/login">Login</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

