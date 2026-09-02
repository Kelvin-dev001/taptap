import Link from "next/link";
import { CreditCard, RectangleHorizontal, ArrowRight } from "lucide-react";
import { Card, buttonVariants } from "@/components/ui";
import {
  HARDWARE_PRICE_KES,
  DEVICE_LABELS,
  BUNDLED_MONTHS,
  formatKes,
  type DeviceKind,
} from "@/lib/pricing";
import { cn } from "@/lib/cn";

const PRODUCTS: {
  code: string;
  kind: DeviceKind;
  icon: typeof CreditCard;
  blurb: string;
}[] = [
  {
    code: "smart_card",
    kind: "card",
    icon: CreditCard,
    blurb: "A tappable card for one person or one counter.",
  },
  {
    code: "smart_stand",
    kind: "stand",
    icon: RectangleHorizontal,
    blurb: "A countertop stand for reviews, menus or Wi-Fi.",
  },
];

/**
 * The way in to checkout, not a checkout.
 *
 * This used to be a full payment form embedded in the billing page. Sprint 7
 * moved the form to `/dashboard/checkout` and left a chooser here, so there is
 * exactly one place a customer can be charged from. Two payment forms is two
 * places to fix a bug in, and two chances to create a duplicate order.
 *
 * Each card links straight in with its product pre-selected, so the number of
 * decisions between wanting one and paying for one stays at "how many".
 */
export function BuyDevice() {
  return (
    <Card padding="md">
      <h2 className="mb-1 text-section-title text-foreground">Add a device</h2>
      <p className="mb-4 text-body-sm text-muted">
        Each one includes {BUNDLED_MONTHS} months and lets you publish one more Tap
        Profile. We ask about artwork once your payment clears.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {PRODUCTS.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.code}
              href={`/dashboard/checkout?product=${p.code}`}
              className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors duration-fast hover:border-border-strong hover:bg-surface-sunken"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <Icon className="h-4 w-4 text-primary-strong" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body-sm font-medium text-foreground">
                  {DEVICE_LABELS[p.kind]}
                </span>
                <span className="text-caption text-muted">
                  {formatKes(HARDWARE_PRICE_KES[p.kind])} each
                </span>
                <span className="mt-0.5 text-caption text-muted">{p.blurb}</span>
              </span>
              <ArrowRight
                className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted transition-transform duration-fast group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>

      <p className="mt-4 text-caption text-muted">
        Kitting out a team?{" "}
        <Link
          href="/quote"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-1")}
        >
          Ask for a quote
        </Link>
      </p>
    </Card>
  );
}
