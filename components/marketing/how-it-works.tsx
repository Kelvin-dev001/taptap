import { Section, SectionHeading } from "./section";
import { Reveal, RevealGroup, RevealItem } from "./reveal";

const STEPS = [
  {
    title: "Pick your card or stand",
    body: "A Smart Card for your pocket, a Smart Stand for the counter or the table. Both turn up ready to go.",
  },
  {
    title: "Set up your page",
    body: "Add your logo, your number, WhatsApp, your review link and where to find you. Most people are done in five minutes.",
  },
  {
    title: "Let people tap",
    body: "Your customers tap or scan, and they are one press away from calling, messaging or reviewing you.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" label="How it works" tone="sunken">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title="You could be using it today."
          align="center"
        />
      </Reveal>

      <RevealGroup className="mt-12 grid gap-6 md:grid-cols-3">
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
