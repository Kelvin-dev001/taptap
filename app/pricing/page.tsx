import Link from "next/link";
import { Check, CreditCard, RectangleHorizontal } from "lucide-react";
import { Card, Badge, buttonVariants } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";
import {
  SEGMENTS,
  SEGMENT_ORDER,
  ACTIVE_ENTITLEMENTS,
  HARDWARE_PRICE_KES,
  RENEWAL_PER_IDENTITY_KES,
  BUNDLED_MONTHS,
  DEVICE_LABELS,
  formatKes,
  type Segment,
} from "@/lib/pricing";
import { cn } from "@/lib/cn";
import { WhatsAppButton } from "@/components/marketing/whatsapp-button";

export const metadata = {
  title: "Pricing",
  description:
    "Pay for the cards you actually use. A Smart Card is KES 1,500 with your first twelve months included, then KES 1,000 a year for each one.",
};

/**
 * Public pricing (D-018, D-021, D-024).
 *
 * States the whole model on one screen: you build for nothing, you activate with
 * a device, the price includes a year, and renewal is per device.
 *
 * There is no free tier and this page must not imply one. It used to open with
 * "Setting up your page is free", which was true of the old model and became a
 * half-truth under D-021: building is still free, staying live is not, and the
 * difference is the entire commercial model.
 *
 * The three cards below are packaging, not tiers. Every one of them buys the
 * same product with the same capabilities at the same price; what differs is how
 * many and how you buy. Attaching feature lists to them is what turned into
 * per-account plans last time (D-024).
 */
export default function PricingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-4">
        <Wordmark subtitle="Pricing" />
        <h1 className="text-display text-foreground">Pay for the cards you actually use</h1>
        <p className="max-w-2xl text-body text-foreground-secondary">
          Build your page for nothing and see exactly what you are buying. It goes live when
          you activate it with a Smart Card or Smart Stand, and your first {BUNDLED_MONTHS}{" "}
          months come with it.
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
          One device publishes one Tap Profile. After your first year, each card or stand you
          are still using renews at{" "}
          <span className="font-medium text-foreground">
            {formatKes(RENEWAL_PER_IDENTITY_KES)} per year
          </span>
          . Renew as many as you like in a single M-Pesa payment. Nothing renews on its own,
          and we never store your card details.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title text-foreground">Every device includes</h2>
        <Card padding="md">
          <ul className="grid gap-2 sm:grid-cols-2">
            {INCLUDED.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 text-body-sm text-foreground-secondary"
              >
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title text-foreground">Which one are you?</h2>
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
      <WhatsAppButton />
    </main>
  );
}

/**
 * What activating actually gets you.
 *
 * Read from ACTIVE_ENTITLEMENTS where a claim maps to a real gate, so this list
 * cannot promise something the product does not enforce. Team access is
 * deliberately absent: it is not built (D-017), and §15 rules out listing it.
 */
const INCLUDED: string[] = [
  "Your Tap Profile live at your own link",
  "Unlimited taps and scans, with no monthly quota",
  "Change where your card points at any time, without re-encoding it",
  ACTIVE_ENTITLEMENTS.leadCapture
    ? "Enquiry capture with email alerts"
    : "Enquiry capture",
  ACTIVE_ENTITLEMENTS.analytics === "full"
    ? "The full report: where people came from, which card, where they are and when"
    : "Taps, views and top actions",
  ACTIVE_ENTITLEMENTS.customBranding
    ? "Your branding, with no Hornbill footer"
    : "Hornbill branding on your page",
  "A printable QR code for the same link",
  `${BUNDLED_MONTHS} months of service, then ${formatKes(RENEWAL_PER_IDENTITY_KES)} a year`,
];

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

/**
 * Packaging, not a tier.
 *
 * Says who it suits and how the purchase works. No feature list, because there
 * is nothing here that differs between them, and inventing a difference to fill
 * three columns is how a fake tier gets born.
 */
function SegmentCard({ code }: { code: Segment }) {
  const segment = SEGMENTS[code];

  const shape =
    code === "individual"
      ? `One ${DEVICE_LABELS.card}, ${formatKes(HARDWARE_PRICE_KES.card)}.`
      : code === "business"
        ? `A card for each person and a stand for the counter, from ${formatKes(
            HARDWARE_PRICE_KES.card,
          )} each.`
        : "Twenty cards or two hundred. We quote you, invoice you, and set them up together.";

  return (
    <Card padding="md" className="flex h-full flex-col gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-card-title text-foreground">{segment.name}</h3>
          {segment.salesLed && <Badge variant="neutral">Talk to sales</Badge>}
        </div>
        <p className="mt-0.5 text-caption text-muted">{segment.audience}</p>
      </div>

      <p className="flex-1 text-body-sm text-foreground-secondary">{shape}</p>

      {segment.salesLed ? (
        <Link href="/quote" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          Ask for a quote
        </Link>
      ) : (
        <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
          Get started
        </Link>
      )}
    </Card>
  );
}
