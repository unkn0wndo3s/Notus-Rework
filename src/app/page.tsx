import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import LandingHeader from "@/components/landing/LandingHeader";
import HeroSection from "@/components/landing/HeroSection";
import FeatureGrid from "@/components/landing/FeatureGrid";
import MetricsSection from "@/components/landing/MetricsSection";
import HowItWorks from "@/components/landing/HowItWorks";
import TestimonialSection from "@/components/landing/TestimonialSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader isLoggedIn={isLoggedIn} />
      <main>
        <HeroSection isLoggedIn={isLoggedIn} />
        <FeatureGrid />
        <MetricsSection />
        <HowItWorks />
        <TestimonialSection />
        <CTASection isLoggedIn={isLoggedIn} />
      </main>
      <LandingFooter isLoggedIn={isLoggedIn} />
    </div>
  );
}

