import SectionHeading from "./SectionHeading";

const metrics = [
  { label: "Time saved per week", value: "2 min", detail: "on document preparation and sharing" },
  { label: "Collaborative documents/month", value: "8+", detail: "created by our active users" },
  { label: "Error reduction", value: "-10%", detail: "thanks to history and integrated validation" },
];

export default function MetricsSection() {
  return (
    <section id="metrics" className="py-20 bg-card/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Measured impact"
          title="Tangible results from the first month"
          description="Notus brings clarity and removes documentation-related friction."
        />
        <dl className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-border bg-background/60 p-6 text-center">
              <dt className="text-sm text-muted-foreground">{metric.label}</dt>
              <dd className="font-title text-4xl text-foreground my-3">{metric.value}</dd>
              <p className="text-sm text-muted-foreground">{metric.detail}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

