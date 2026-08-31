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
    a: "No. Tapping just opens their normal browser, the same one they use every day. If their phone is older and does not tap, the QR code works with any camera.",
  },
  {
    q: "Does it work on iPhone?",
    a: "Yes. Newer iPhones read the card without any app at all, and every phone on earth can scan a QR code.",
  },
  {
    q: "Can I change my links later?",
    a: "As often as you like. The card in your pocket stays exactly the same. Only what it opens changes.",
  },
  {
    q: "What happens after the first year?",
    a: `Each card or stand you are still using renews at ${RENEWAL} for the year. One M-Pesa payment covers all of them together, so you are not paying bit by bit.`,
  },
  {
    q: "What if I lose a card?",
    a: "Switch it off from your dashboard and it stops working there and then, so nobody can use it. Your page and everything on it stays safe.",
  },
  {
    q: "How do I pay?",
    a: "M-Pesa. A prompt comes to your phone, you enter your PIN, and that is it.",
  },
  {
    q: "Is my data safe?",
    a: (
      <>
        Yes. We follow Kenya&rsquo;s Data Protection Act. You can download your data
        whenever you want, and ask us to delete it. Have a read of our{" "}
        <Link href="/privacy" className="text-primary-strong underline">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    q: "Can I get cards for my whole team?",
    a: "Yes. Every person or branch gets their own card and their own page, and you run all of it from one account.",
  },
];

export function Faq() {
  return (
    <Section id="faq" label="Frequently asked questions">
      <Reveal>
        <SectionHeading eyebrow="FAQ" title="Things people ask us." align="center" />
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
