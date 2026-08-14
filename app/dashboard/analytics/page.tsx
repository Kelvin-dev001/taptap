import Link from "next/link";
import { ChartNoAxesColumn, ArrowRight } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, EmptyState, Alert, buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

/**
 * Analytics index.
 *
 * Per-profile analytics already exist and are real, so this lists the profiles
 * and routes into them. It deliberately does NOT show an account-wide chart:
 * `get_account_overview` returns bare totals with no daily series and no prior
 * period, so any roll-up chart or trend here would be invented. The real
 * account-level view arrives in UI-7 with audit item B8.
 */
export default async function AnalyticsIndexPage() {
  const supabase = await createServerSupabase();
  const { data: pages } = await supabase
    .from("smart_pages")
    .select("id, slug, title")
    .order("created_at", { ascending: false });

  const rows = pages ?? [];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Taps, scans, views and clicks for each Tap Profile."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ChartNoAxesColumn}
          title="Nothing to measure yet"
          description="Create a Tap Profile and share it — taps and scans will show up here."
          action={
            <Link href="/dashboard/profiles" className={cn(buttonVariants())}>
              Create a link
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/profiles/${p.id}/analytics`}
                className="rounded-xl focus-visible:outline-none"
              >
                <Card padding="sm" interactive className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-card-title text-foreground">
                      {p.title || `/${p.slug}`}
                    </span>
                    <span className="truncate text-caption text-muted">/{p.slug}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </Card>
              </Link>
            ))}
          </div>

          <Alert tone="info" className="mt-6" title="Account-wide reporting is coming">
            Combined charts, a date-range selector and CSV export land in a later sprint.
            Per-profile numbers above are live.
          </Alert>
        </>
      )}
    </>
  );
}
