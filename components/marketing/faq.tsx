import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatKes, RENEWAL_PER_IDENTITY_KES } from "@/lib/pricing";
import { Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";

/**
 * FAQ, built on native <details>/<summary>.
 *
 * No JavaScript at all: it is keyboard-operable, announced correctly by screen
 * readers, expands before hydration and still works if the bundle never
 * arrives. A hand-rolled accordion would ship state, effects and aria wiring to
 * do worse — this is the case where the platform primitive genuinely wins.
 *
 * Answers are checked against what the product does. Deletion is by request
 * (see /privacy) rather than a self-serve button, and this says so, because a
 * data-protection right stated more strongly than it is honoured is worse than
 * one stated plainly.
 */
const RENEWAL = formatKes(RENEWAL_PER_IDENTITY_KES);

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Do my customers need an app?",
    a: "No. Tapping opens their normal phone browser. If their phone doesn't do NFC, the QR code works on any camera.",
  },
  {
    q: "Does it work on iPhone?",
    a: "Yes. Modern iPhones read NFC without an app, and every phone can scan the QR.",
  },
  {
    q: "Can I change my links later?",
    a: "Any time, as often as you like. Your card doesn't change — only what it opens.",
  },
  {
    q: "What happens after the first year?",
    a: `Each active identity renews at ${RENEWAL} per year. One payment covers all your cards and stands together.`,
  },
  {
    q: "What if I lose a card?",
    a: "Disable it from your dashboard and it stops working immediately. Your profile is safe.",
  },
  {
    q: "How do I pay?",
    a: "M-Pesa. You'll get an STK prompt on your phone and enter your PIN.",
  },
  {
    q: "Is my data safe?",
    a: (
      <>
        Yes. We follow Kenya&rsquo;s Data Protection Act. You can export your data at any
        time, and ask us to delete it — see our{" "}
        <Link href="/privacy" className="text-primary-strong underline">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    q: "Can I get cards for my whole team?",
    a: "Yes — each person or location gets its own identity, all managed from one account.",
  },
];

export function Faq() {
  return (
    <Section id="faq" label="Frequently asked questions">
      <Reveal>
        <SectionHeading eyebrow="FAQ" title="Questions people ask us." align="center" />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mx-auto mt-10 max-w-3xl divide-y divide-border rounded-xl border border-border bg-surface">
          {QUESTIONS.map(({ q, a }) => (
            <details key={q} className="group px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-body font-medium text-foreground marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted transition-transform duration-base group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="pb-4 pr-8 text-body-sm leading-relaxed text-foreground-secondary">
                {a}
              </div>
            </details>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}
