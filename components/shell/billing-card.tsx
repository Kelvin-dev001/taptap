import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { SegmentDefinition } from "@/lib/pricing";
import type { BillingSummary } from "@/lib/identity";

/**
 * Sidebar billing summary.
 *
 * The reference mockup shows a tap-quota meter ("8,420 of 10,000 monthly taps
 * used"). Still not built, and still on purpose: no quota model exists — taps
 * are unmetered — so rendering a meter would mean inventing the denominator.
 *
 * What replaced it is a real number: how many devices this account owns and
 * when the next one falls due (D-018). Both are facts, and both are actionable.
 */
export function BillingCard({
  segment,
  summary,
  renewsOn,
}: {
  segment: SegmentDefinition;
  summary: BillingSummary;
  renewsOn?: string | null;
}) {
  const none = summary.billable === 0;

  return (
    <div className="rounded-xl bg-surface-inverse p-3.5 text-on-inverse">
      <p className="text-[10px] uppercase tracking-[0.08em] text-primary-300">
        {none ? "Free" : segment.name}
      </p>
      <p className="mt-1 text-caption text-on-inverse-muted">
        {none
          ? "Get a card or stand to unlock enquiries and the full report."
          : summary.hasLapsed
            ? "A device has stopped working — renew to bring it back."
            : `${summary.active} active ${summary.active === 1 ? "device" : "devices"}${
                renewsOn ? ` · renews ${renewsOn}` : ""
              }`}
      </p>
      <Link
        href="/dashboard/billing"
        className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-caption font-medium text-on-inverse transition-colors duration-fast hover:bg-white/20"
      >
        {none ? "See pricing" : "Manage billing"}
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}
