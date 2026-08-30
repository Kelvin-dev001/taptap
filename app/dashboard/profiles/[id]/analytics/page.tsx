import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import { AnalyticsReport } from "@/components/analytics/analytics-report";
import { loadBillingContext } from "@/lib/billing-context";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { parseRange, rangeLabel, comparisonLabel } from "@/lib/metrics";
import type { Analytics } from "@/lib/analytics";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function ProfileAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range } = await searchParams;
  const days = parseRange(range);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("account_id").eq("id", user.id).single()
    : { data: null };

  const [{ data: page }, { data, error }, billing] = await Promise.all([
    supabase.from("smart_pages").select("id, slug, title").eq("id", id).single(),
    supabase.rpc("get_analytics", { p_days: days, p_page_id: id }),
    loadBillingContext(supabase, me?.account_id),
  ]);

  const depth = billing.entitlements.analytics;

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader
          title="Analytics"
          breadcrumbs={[{ label: "Tap Profiles", href: "/dashboard/profiles" }]}
        />
        <MigrationNotice migration="0011_analytics.sql" />
      </>
    );
  }

  if (!page) notFound();

  const analytics = (data ?? null) as Analytics | null;
  if (!analytics) notFound();

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`${page.title || `/${page.slug}`} · ${rangeLabel(days)} · ${comparisonLabel(days)}`}
        breadcrumbs={[
          { label: "Tap Profiles", href: "/dashboard/profiles" },
          { label: "Analytics", href: "/dashboard/analytics" },
        ]}
        actions={
          <>
            <RangeTabs value={days} />
            {depth === "full" && (
              <a
                href={`/api/analytics/csv?range=${days}&page=${id}`}
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </a>
            )}
          </>
        }
      />
      <AnalyticsReport data={analytics} days={days} depth={depth} />
    </>
  );
}
