import Link from "next/link";
import { IdCard, Plus } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { MetricCard, EmptyState, buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

/**
 * Dashboard home. UI-2 re-homes this on the app shell and fixes the fixed
 * five-column metric grid (finding R1); the actionable-intelligence rebuild —
 * trends, sparklines, activity feed, insights — is UI-3, and needs the
 * account-level RPCs (audit items B8/B9) that do not exist yet.
 *
 * Deltas are deliberately absent: `get_account_overview` returns totals for a
 * single window with nothing to compare against, so there is no honest trend to
 * show yet (CLAUDE.md §15).
 */
export default async function DashboardPage() {
  const supabase = await createServerSupabase();

  const { data: overviewData } = await supabase.rpc("get_account_overview", {
    p_days: 30,
  });
  const overview = (overviewData ?? {}) as {
    pages?: number;
    totals?: Record<string, number>;
    leads?: number;
  };
  const t = overview.totals ?? {};
  const summary = [
    { label: "Taps", value: t.tap ?? 0 },
    { label: "QR scans", value: t.scan ?? 0 },
    { label: "Profile views", value: t.view ?? 0 },
    { label: "Button clicks", value: t.click ?? 0 },
    { label: "Leads", value: overview.leads ?? 0 },
  ];

  const hasProfiles = (overview.pages ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Activity across all your Tap Profiles in the last 30 days."
        actions={
          <Link href="/dashboard/profiles" className={cn(buttonVariants({ size: "md" }))}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New link
          </Link>
        }
      />

      {hasProfiles ? (
        <section aria-label="Last 30 days">
          {/* Was grid-cols-5 at every width, which produced ~55px tiles on a
              phone (finding R1). */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {summary.map((s) => (
              <MetricCard key={s.label} label={s.label} value={s.value.toLocaleString()} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={IdCard}
          title="Create your first link"
          description="A link is what your NFC card or QR code points to. You can change where it goes at any time without touching the card."
          action={
            <Link href="/dashboard/profiles" className={cn(buttonVariants())}>
              Create a link
            </Link>
          }
        />
      )}
    </>
  );
}
