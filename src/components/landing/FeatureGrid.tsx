import { Card } from "@/components/ui";
import Icon, { type IconName } from "@/components/Icon";
import SectionHeading from "./SectionHeading";

interface Feature {
  title: string;
  description: string;
  icon: IconName;
  highlight?: string;
}

const features: Feature[] = [
  {
    title: "Editor",
    description: "Advanced formatting, collaborative components, mentions and media integrations.",
    icon: "note",
    highlight: "Real-time",
  },
  {
    title: "Instant Collaboration",
    description: "Invite your teammates, assign tasks and discuss directly in the document.",
    icon: "users",
    highlight: "Shared Access",
  },
  {
    title: "AI Synthesis",
    description: "Summarize your notes in one click with our contextual synthesis engine.",
    icon: "sparkles",
    highlight: "Integrated AI",
  },
  {
    title: "Clear Organization",
    description: "Organize your notes with folders and tags. Find the right information immediately.",
    icon: "folder",
  },
  {
    title: "Full History",
    description: "Go back to any version of your document and compare changes.",
    icon: "clock",
  },
  {
    title: "Contextual Comments",
    description: "Add targeted annotations and receive personalized notifications.",
    icon: "comment",
  },
  {
    title: "Smart Search",
    description: "Filters, tags... find the right note in seconds.",
    icon: "search",
  },
  {
    title: "Secure Sharing",
    description: "Define precise access levels. Notus respects your GDPR requirements.",
    icon: "shieldCheck",
  },
  {
    title: "Quick Favorites",
    description: "Pin your critical documents to find them instantly.",
    icon: "star",
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title="Everything your team needs"
          description="Powerful and simple-to-use tools to support every stage of your document workflow."
        />
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="h-full p-6 border-border flex flex-col gap-4">
              <div className="inline-flex items-center gap-3">
                <span className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Icon name={feature.icon} className="w-6 h-6" aria-hidden="true" />
                </span>
                {feature.highlight && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {feature.highlight}
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-title text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

