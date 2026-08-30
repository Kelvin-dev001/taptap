import { Section, SectionHeading } from "./section";
import { Reveal, RevealGroup, RevealItem } from "./reveal";

const STEPS = [
  {
    title: "Get your card or stand",
    body: "A Smart Card for your pocket, a Smart Stand for your counter or table. Both arrive ready to use.",
  },
  {
    title: "Build your profile",
    body: "Add your logo, contact details, WhatsApp, review link, socials and location. It takes about five minutes.",
  },
  {
    title: "Start tapping",
    body: "Customers tap or scan, act instantly, and you watch it all in your dashboard.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" label="How it works" tone="sunken">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title="Up and running the same day."
          align="center"
        />
      </Reveal>

      <RevealGroup className="mt-12 grid gap-6 md:grid-cols-3" stagger={0.1}>
        {STEPS.map((step, i) => (
          <RevealItem key={step.title}>
            <div className="relative flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-6 shadow-xs">
              {/* The number is decorative — the heading order already carries
                  the sequence for anyone not seeing the layout. */}
              <span
                aria-hidden="true"
                className="text-[2.5rem] font-bold leading-none text-primary-200"
              >
                {i + 1}
              </span>
              <h3 className="text-section-title text-foreground">{step.title}</h3>
              <p className="text-body-sm text-muted">{step.body}</p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}
