import Link from "next/link";
import { Check, CreditCard, RectangleHorizontal } from "lucide-react";
import { Card, Badge, buttonVariants } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";
import {
  SEGMENTS,
  SEGMENT_ORDER,
  HARDWARE_PRICE_KES,
  RENEWAL_PER_IDENTITY_KES,
  BUNDLED_MONTHS,
  DEVICE_LABELS,
  formatKes,
  type Segment,
} from "@/lib/pricing";
import { cn } from "@/lib/cn";

export const metadata = {
  title: "Pricing",
  description:
    "Pay for the devices you use. A Smart Card is KES 1,500 including the first twelve months, then KES 1,000 per device per year.",
};

/**
 * Public pricing (D-018).
 *
 * States the whole model on one screen: you buy a device, the price includes a
 * year, and renewal is per device. Every claim here is one the product actually
 * enforces — §15 and §30.7 rule out listing capability we have not shipped, so
 * Commercial is sold on team access and support rather than an analytics tier
 * that does not yet differ from Business.
 */
export default function PricingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-4">
        <Wordmark subtitle="Pricing" />
        <h1 className="text-display text-foreground">Pay for the cards you use</h1>
        <p className="max-w-2xl text-body text-foreground-secondary">
          Building a Tap Profile is free. You pay for the physical device that makes it
          tappable — and the price includes the first {BUNDLED_MONTHS} months.
        </p>
      </div>

      {/* Hardware first: it is the only thing anyone pays on day one. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section-title text-foreground">Devices</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <DeviceCard
            icon={CreditCard}
            kind="card"
            description="A tappable card for one person or one counter."
          />
          <DeviceCard
            icon={RectangleHorizontal}
            kind="stand"
            description="A countertop stand for reviews, menus or Wi-Fi."
          />
        </div>
        <p className="text-body-sm text-muted">
          After the first year, each active device renews at{" "}
          <span className="font-medium text-foreground">
            {formatKes(RENEWAL_PER_IDENTITY_KES)} per year
          </span>
          . Renew as many as you like in one M-Pesa payment. Nothing renews automatically and
          no card details are stored.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title text-foreground">What you get</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {SEGMENT_ORDER.map((code) => (
            <SegmentCard key={code} code={code} />
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-caption text-muted">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
        <span>Prices in Kenyan shillings, VAT inclusive where applicable.</span>
      </footer>
    </main>
  );
}

function DeviceCard({
  icon: Icon,
  kind,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  kind: "card" | "stand";
  description: string;
}) {
  return (
    <Card padding="md" className="flex flex-col gap-1">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft">
        <Icon className="h-4 w-4 text-primary-strong" />
      </span>
      <h3 className="mt-2 text-card-title text-foreground">{DEVICE_LABELS[kind]}</h3>
      <p className="text-page-title text-foreground">{formatKes(HARDWARE_PRICE_KES[kind])}</p>
      <p className="text-caption text-muted">
        One-off, includes {BUNDLED_MONTHS} months of service
      </p>
      <p className="mt-1 text-body-sm text-foreground-secondary">{description}</p>
    </Card>
  );
}

function SegmentCard({ code }: { code: Segment }) {
  const segment = SEGMENTS[code];
  const e = segment.entitlements;

  const features = [
    code === "professional" ? "One card" : "As many cards and stands as you need",
    "Unlimited Tap Profiles",
    e.analytics === "full"
      ? "Full report — source, per-card, location and timing"
      : "Taps, views and top actions",
    e.leadCapture && "Enquiry capture with email alerts",
    e.customBranding && "Your branding, no Hornbill footer",
    e.teamManagement && "Team access across locations",
    e.support === "priority"
      ? "Priority support"
      : e.support === "business"
        ? "Business support"
        : "Standard support",
  ].filter(Boolean) as string[];

  return (
    <Card padding="md" className="flex h-full flex-col gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-card-title text-foreground">{segment.name}</h3>
          {segment.salesLed && <Badge variant="neutral">Talk to sales</Badge>}
        </div>
        <p className="mt-0.5 text-caption text-muted">{segment.audience}</p>
      </div>

      <p className="text-body-sm text-foreground-secondary">
        {segment.salesLed
          ? `From ${formatKes(RENEWAL_PER_IDENTITY_KES)} per identity / year`
          : `${formatKes(RENEWAL_PER_IDENTITY_KES)} per device / year after the first`}
      </p>

      <ul className="flex flex-1 flex-col gap-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-body-sm text-foreground-secondary">
            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>

      {segment.salesLed ? (
        <a
          href="mailto:sales@hornbilltech.co.ke?subject=Hornbill%20TapTap%20-%20Commercial"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          Talk to sales
        </a>
      ) : (
        <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
          Get started
        </Link>
      )}
    </Card>
  );
}
