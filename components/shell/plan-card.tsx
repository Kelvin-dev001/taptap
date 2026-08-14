import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Plan } from "@/lib/plans";

/**
 * Sidebar plan summary.
 *
 * The reference mockup shows a tap-quota meter ("8,420 of 10,000 monthly taps
 * used"). That is not built here on purpose: no quota model exists in
 * lib/plans.ts, and CLAUDE.md §21 keeps usage out of the billing surface.
 * Rendering a meter would mean inventing the denominator. Plan name and a route
 * to upgrade are the honest version.
 */
export function PlanCard({ plan, renewsOn }: { plan: Plan; renewsOn?: string | null }) {
  const isFree = plan.code === "free";

  return (
    <div className="rounded-xl bg-surface-inverse p-3.5 text-on-inverse">
      <p className="text-[10px] uppercase tracking-[0.08em] text-primary-300">
        {plan.name} plan
      </p>
      <p className="mt-1 text-caption text-on-inverse-muted">
        {isFree
          ? "Upgrade for more links, lead capture and richer analytics."
          : renewsOn
            ? `Renews ${renewsOn}`
            : "Active"}
      </p>
      <Link
        href="/dashboard/billing"
        className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-caption font-medium text-on-inverse transition-colors duration-fast hover:bg-white/20"
      >
        {isFree ? "Upgrade workspace" : "Manage billing"}
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}
