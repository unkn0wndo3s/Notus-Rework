import SectionHeading from "./SectionHeading";
import { Card } from "@/components/ui";

const testimonials = [
  {
    name: "Moïse Aérien",
    role: "Freelance Developer",
    quote:
      "Notus has cut internal note consolidation time in half. The editor and AI syntheses have become indispensable for writing messages for my clients.",
  },
  {
    name: "Gastien Bitard",
    role: "CEO, DotTxt",
    quote:
      "We finally have a single repository for product and support teams. Shared folders save us multiple meetings.",
  },
  {
    name: "Methane Manchot",
    role: "Project Manager, Yanotela",
    quote:
      "Version tracking and contextual comments have streamlined our validations. Adoption was immediate.",
  },
];

export default function TestimonialSection() {
  return (
    <section id="testimonials" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="They use Notus"
          title="Demanding teams trust us"
          description="SMEs, law firms, scale-ups... all gain documentary efficiency."
        />
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="h-full border-border p-6 flex flex-col gap-4">
              <p className="text-lg text-foreground">“{testimonial.quote}”</p>
              <div>
                <p className="font-semibold text-foreground">{testimonial.name}</p>
                <p className="text-sm text-muted-foreground">{testimonial.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

