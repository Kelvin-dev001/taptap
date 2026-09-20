import Link from "next/link";
import { CreditCard, RectangleHorizontal, Sparkles, ArrowRight } from "lucide-react";
import { Card, buttonVariants } from "@/components/ui";
import { SELLABLE_PRODUCTS, BUNDLED_MONTHS, formatKes } from "@/lib/pricing";
import { cn } from "@/lib/cn";

/**
 * Icons only. This used to carry its own list of products, prices and blurbs —
 * a second copy of the catalogue, which is how Premium came to be missing from
 * the chooser entirely and how a Premium card would have been shown at the
 * Standard price (D-018: one source of truth for money).
 */
const PRODUCT_ICONS: Record<string, typeof CreditCard> = {
  smart_card: CreditCard,
  smart_card_premium: Sparkles,
  smart_stand: RectangleHorizontal,
};

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
        Profile.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {SELLABLE_PRODUCTS.map((p) => {
          const Icon = PRODUCT_ICONS[p.code] ?? CreditCard;
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
                <span className="text-body-sm font-medium text-foreground">{p.name}</span>
                <span className="text-caption text-muted">
                  {formatKes(p.priceKes)} each
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
