import Link from "next/link";
import { Eye } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { BUNDLED_MONTHS, HARDWARE_PRICE_KES, formatKes } from "@/lib/pricing";
import { cn } from "@/lib/cn";

/**
 * "Not live yet", said honestly and in one place.
 *
 * Shown on the dashboard, the profiles list and the builder, so an owner is
 * never in doubt about whether the thing they are editing is public. The wording
 * matters more than it looks: a draft is NOT LOCKED and must not be described
 * that way. Nothing has been taken away, nothing is being withheld as leverage,
 * and the page they are building is genuinely theirs. It simply has no card
 * pointing at it yet.
 *
 * A server component with no state, because a banner that has to hydrate before
 * it can tell you your page is not live is a banner that sometimes does not.
 */
export function DraftBanner({
  slug,
  className,
  compact,
}: {
  slug?: string | null;
  className?: string;
  /** Drops the explanatory line where space is tight, keeping the CTA. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-warning-soft p-3.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Eye className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-body-sm font-medium text-foreground">
            Draft. Not live yet.
          </p>
          {!compact && (
            <p className="text-caption text-foreground-secondary">
              Only you can see this. Activate it with a Smart Card from{" "}
              {formatKes(HARDWARE_PRICE_KES.card)}, which includes {BUNDLED_MONTHS} months,
              and it goes live at{" "}
              <span className="font-medium text-foreground">
                taptap.hornbilltech.co.ke/{slug ?? "your-link"}
              </span>
              .
            </p>
          )}
        </div>
      </div>

      <Link
        href="/dashboard/checkout"
        className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
      >
        Activate to publish
      </Link>
    </div>
  );
}
