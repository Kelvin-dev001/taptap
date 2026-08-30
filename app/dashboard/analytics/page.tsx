import Link from "next/link";
import { ChartNoAxesColumn, Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadBillingContext } from "@/lib/billing-context";
import { EmptyState, buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import { AnalyticsReport } from "@/components/analytics/analytics-report";
import { EntitlementNotice } from "@/components/billing/entitlement-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { parseRange, rangeLabel, comparisonLabel } from "@/lib/metrics";
import type { Analytics } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = parseRange(range);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("account_id").eq("id", user.id).single()
    : { data: null };

  const [{ data, error }, billing] = await Promise.all([
    supabase.rpc("get_analytics", { p_days: days, p_page_id: null }),
    loadBillingContext(supabase, profile?.account_id),
  ]);

  const depth = billing.entitlements.analytics;

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Analytics" />
        <MigrationNotice migration="0011_analytics.sql" />
      </>
    );
  }

  const analytics = (data ?? null) as Analytics | null;

  if (!analytics || analytics.pages === 0) {
    return (
      <>
        <PageHeader title="Analytics" />
        <EmptyState
          icon={ChartNoAxesColumn}
          title="Nothing to measure yet"
          description="Create a Tap Profile and share it — taps, scans and clicks will show up here."
          action={
            <Link href="/dashboard/profiles" className={cn(buttonVariants())}>
              Create a link
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`${rangeLabel(days)} · ${comparisonLabel(days)}`}
        actions={
          <>
            <RangeTabs value={days} />
            {depth === "full" && (
              <a
                href={`/api/analytics/csv?range=${days}`}
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </a>
            )}
          </>
        }
      />
      <AnalyticsReport data={analytics} days={days} showPages depth={depth} />
      {depth === "basic" && (
        <div className="mt-4">
          <EntitlementNotice feature="Attribution, per-card, location and timing" />
        </div>
      )}
    </>
  );
}
