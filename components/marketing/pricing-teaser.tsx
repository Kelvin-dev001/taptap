import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  HARDWARE_PRICE_KES,
  RENEWAL_PER_IDENTITY_KES,
  BUNDLED_MONTHS,
  formatKes,
} from "@/lib/pricing";
import { cn } from "@/lib/cn";
import { Section, SectionHeading } from "./section";
import { Reveal, RevealGroup, RevealItem } from "./reveal";

/**
 * Pricing teaser.
 *
 * Every figure is read from `lib/pricing.ts`, never typed, so this page cannot
 * drift from what the checkout actually charges (D-018). Changing a price in
 * one file changes it here, on /pricing, and in the M-Pesa prompt together.
 *
 * These are SEGMENTS, not tiers (D-024). Every one of them buys the same
 * product with the same capabilities at the same price, so the rows describe
 * what genuinely differs — which devices suit you, and how you buy them.
 *
 * Two claims were removed rather than carried forward. The columns used to show
 * "Basic report" against Professional and "Full report" against Business, which
 * stopped being true when entitlements collapsed to paid-or-not: every paying
 * account now gets the full report, and a comparison table implying otherwise
 * would be selling a restriction that no longer exists. Team management went for
 * the older reason: it is not built (D-017), and §15 rules out listing it.
 */
const CARD = formatKes(HARDWARE_PRICE_KES.card);
const STAND = formatKes(HARDWARE_PRICE_KES.stand);
const RENEWAL = formatKes(RENEWAL_PER_IDENTITY_KES);

const PLANS = [
  {
    name: "Individual",
    for: "One person, one card",
    card: CARD,
    stand: null,
    renewal: `${RENEWAL} / card / year`,
    identities: "One card, one live profile",
    support: "Standard support",
    cta: { label: "Get started", href: "/login", primary: true },
  },
  {
    name: "Business",
    for: "Shops, salons, restaurants, clinics",
    card: CARD,
    stand: STAND,
    renewal: `${RENEWAL} / card / year`,
    identities: "A card each, plus stands",
    support: "Standard support",
    cta: { label: "Get started", href: "/login", primary: true },
    featured: true,
  },
  {
    name: "Corporate",
    for: "Kitting out a whole team",
    card: `From ${CARD}`,
    stand: `From ${STAND}`,
    renewal: `From ${RENEWAL} / card / year`,
    identities: "As many as you need",
    support: "Priority support",
    cta: { label: "Talk to Sales", href: "/quote", primary: false },
  },
];

export function PricingTeaser() {
  return (
    <Section id="pricing" label="Pricing">
      <Reveal>
        <SectionHeading
          eyebrow="Pricing"
          title="Straightforward pricing, no monthly surprises."
          sub={`Build your page for nothing, then activate it with a card or stand. Your first year comes with it, and after that it is ${RENEWAL} a year for each one you are still using.`}
          align="center"
        />
      </Reveal>

      <RevealGroup className="mt-12 grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <RevealItem key={plan.name} className="h-full">
            <div
              className={cn(
                "flex h-full flex-col gap-4 rounded-2xl border bg-surface p-6 transition-shadow duration-base",
                plan.featured
                  ? "border-primary-strong shadow-md"
                  : "border-border shadow-xs hover:shadow-sm",
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-section-title text-foreground">{plan.name}</h3>
                  {plan.featured && (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-caption font-medium text-primary-strong">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-body-sm text-muted">{plan.for}</p>
              </div>

              <dl className="flex flex-col gap-2 border-y border-border py-4 text-body-sm">
                <Row label="Smart Card" value={plan.card} />
                <Row label="Smart Stand" value={plan.stand} />
                <Row label="First year" value="Included" />
                <Row label="Renewal" value={plan.renewal} />
                <Row label="What you publish" value={plan.identities} />
                <Row label="Full report" value="Included" />
                <Row label="Enquiry capture" value="Included" />
                <Row label="Support" value={plan.support} />
              </dl>

              <Link
                href={plan.cta.href}
                className={cn(
                  buttonVariants({
                    variant: plan.cta.primary ? "primary" : "secondary",
                    full: true,
                  }),
                  "mt-auto transition-transform duration-fast active:scale-[0.98]",
                )}
              >
                {plan.cta.label}
              </Link>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal delay={0.1}>
        <p className="mt-8 text-center text-body-sm text-muted">
          One card or stand publishes one page. Your first {BUNDLED_MONTHS} months are
          already paid for in the price.{" "}
          <Link href="/pricing" className="text-primary-strong underline">
            See full pricing
          </Link>
          .
        </p>
      </Reveal>
    </Section>
  );
}

/** A null value renders a dash, not a blank — absence has to be legible too. */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center gap-1.5 font-medium text-foreground sm:text-right">
        {value ? (
          <>
            <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            {value}
          </>
        ) : (
          <>
            <Minus className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-muted">Not included</span>
          </>
        )}
      </dd>
    </div>
  );
}
