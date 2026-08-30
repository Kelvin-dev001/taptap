import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui";
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
 * Two rows differ from the original copy deck, deliberately. It listed
 * "Advanced" analytics for Commercial and "Optional" team management for
 * Business; the product ships neither — `AnalyticsDepth` is only basic-or-full,
 * and team management is unbuilt (D-017). Commercial is sold on what it really
 * offers instead: multi-location, team access and priority support.
 */
const CARD = formatKes(HARDWARE_PRICE_KES.card);
const STAND = formatKes(HARDWARE_PRICE_KES.stand);
const RENEWAL = formatKes(RENEWAL_PER_IDENTITY_KES);

const PLANS = [
  {
    name: "Professional",
    for: "Individuals & professionals",
    card: CARD,
    stand: null,
    renewal: `${RENEWAL} / identity / year`,
    identities: "1",
    analytics: "Basic report",
    team: false,
    support: "Standard support",
    cta: { label: "Get started", href: "/login", primary: true },
  },
  {
    name: "Business",
    for: "Shops, salons, restaurants, clinics",
    card: CARD,
    stand: STAND,
    renewal: `${RENEWAL} / identity / year`,
    identities: "Multiple",
    analytics: "Full report",
    team: false,
    support: "Business support",
    cta: { label: "Get started", href: "/login", primary: true },
    featured: true,
  },
  {
    name: "Commercial",
    for: "Multi-location organizations",
    card: `From ${CARD}`,
    stand: `From ${STAND}`,
    renewal: `From ${RENEWAL} / identity / year`,
    identities: "Multiple locations",
    analytics: "Full report",
    team: true,
    support: "Priority support",
    cta: {
      label: "Talk to Sales",
      href: "mailto:sales@hornbilltech.co.ke?subject=Hornbill%20TapTap%20-%20Commercial",
      primary: false,
    },
  },
];

export function PricingTeaser() {
  return (
    <Section id="pricing" label="Pricing">
      <Reveal>
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing. No monthly surprises."
          sub={`Buy the hardware once — your first year is included. After that it's ${RENEWAL} per active identity, per year.`}
          align="center"
        />
      </Reveal>

      <RevealGroup className="mt-12 grid gap-4 lg:grid-cols-3" stagger={0.08}>
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
                <Row label="Identities" value={plan.identities} />
                <Row label="Analytics" value={plan.analytics} />
                <Row label="Team management" value={plan.team ? "Yes" : null} />
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
          An identity is one card or stand and the profile behind it. The first{" "}
          {BUNDLED_MONTHS} months are included in the hardware price.{" "}
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
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right font-medium text-foreground">
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
