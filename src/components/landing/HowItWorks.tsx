import SectionHeading from "./SectionHeading";

const steps = [
  {
    title: "Configure your space",
    description: "Invite your teammates, define your folders and connect your existing tools.",
  },
  {
    title: "Produce your documents",
    description: "Write briefs, notes and reports in an editor designed for collaboration.",
  },
  {
    title: "Share and track",
    description: "Secure distribution, targeted comments and alerts to stay aligned.",
  },
];

export default function HowItWorks() {
  return (
    <section id="process" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Process"
          title="Simple onboarding, immediate adoption"
          description="Designed to support business teams and project teams alike."
        />
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <article key={step.title} className="text-center border border-border rounded-2xl p-8 bg-card/50">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary text-lg font-bold mb-5">
                {index + 1}
              </div>
              <h3 className="font-title text-2xl text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-base">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

