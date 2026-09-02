import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
 *
 * There is no plan name here any more, because there are no plans (D-024). An
 * account either owns working devices or it does not, and the version of this
 * card that said "Free" was describing a tier that no longer exists.
 */
export function BillingCard({
  summary,
  renewsOn,
}: {
  summary: BillingSummary;
  renewsOn?: string | null;
}) {
  const none = summary.billable === 0;

  return (
    <div className="rounded-xl bg-surface-inverse p-3.5 text-on-inverse">
      <p className="text-[10px] uppercase tracking-[0.08em] text-primary-300">
        {none ? "Not active yet" : "Your devices"}
      </p>
      <p className="mt-1 text-caption text-on-inverse-muted">
        {none
          ? "Activate a Smart Card or Smart Stand to publish your profile."
          : summary.hasLapsed
            ? "A device has stopped working. Renew to bring it back."
            : `${summary.active} active ${summary.active === 1 ? "device" : "devices"}${
                renewsOn ? ` · renews ${renewsOn}` : ""
              }`}
      </p>
      <Link
        href={none ? "/dashboard/checkout" : "/dashboard/billing"}
        className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-caption font-medium text-on-inverse transition-colors duration-fast hover:bg-white/20"
      >
        {none ? "Activate" : "Manage billing"}
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}
