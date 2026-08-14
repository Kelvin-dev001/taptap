import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { MetricCard, Card } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { BarChart, RankedBars, type Series } from "@/components/charts/bar-chart";

export const dynamic = "force-dynamic";

type Analytics = {
  days: number;
  totals: Record<string, number>;
  daily: { date: string; count: number }[];
  devices: Record<string, number>;
  os: Record<string, number>;
  top_blocks: { label: string; count: number }[];
};

/**
 * Metric labels say exactly what was measured. "Button clicks" is a click, not
 * a conversion — the platform cannot know whether a review was left or a
 * WhatsApp message was sent (CLAUDE.md §15). The click/conversion split and a
 * date-range selector arrive in UI-7.
 */
const DAY_SERIES: Series[] = [
  { key: "all", label: "All activity", color: "var(--color-primary)" },
];

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : iso;
}

const METRICS: { key: string; label: string }[] = [
  { key: "tap", label: "Taps" },
  { key: "scan", label: "QR scans" },
  { key: "view", label: "Profile views" },
  { key: "click", label: "Button clicks" },
  { key: "download", label: "Contacts saved" },
  { key: "lead", label: "Leads" },
];

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: page } = await supabase
    .from("smart_pages")
    .select("id, slug, title")
    .eq("id", id)
    .single();
  if (!page) notFound();

  const { data } = await supabase.rpc("get_page_analytics", {
    p_page_id: id,
    p_days: 30,
  });
  const a = (data ?? null) as Analytics | null;

  const totals = a?.totals ?? {};
  const daily = a?.daily ?? [];
  const devices = Object.entries(a?.devices ?? {}).map(([label, value]) => ({
    label,
    value: value as number,
  }));
  const topBlocks = a?.top_blocks ?? [];

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`${page.title || `/${page.slug}`} · last 30 days`}
        breadcrumbs={[
          { label: "Tap Profiles", href: "/dashboard/profiles" },
          { label: "Analytics", href: "/dashboard/analytics" },
        ]}
      />

      {/* Was a fixed grid-cols-3 for six metrics (finding R2). */}
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {METRICS.map((m) => (
          <MetricCard
            key={m.key}
            label={m.label}
            value={(totals[m.key] ?? 0).toLocaleString()}
          />
        ))}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card padding="md" className="lg:col-span-2">
          <h2 className="mb-3 text-section-title text-foreground">Activity by day</h2>
          <BarChart
            data={daily.map((d) => ({ label: d.date, values: { all: d.count } }))}
            series={DAY_SERIES}
            formatLabel={shortDate}
          />
        </Card>

        <Card padding="md">
          <h2 className="mb-3 text-section-title text-foreground">Devices</h2>
          <RankedBars data={devices} />
        </Card>

        <Card padding="md">
          <h2 className="mb-1 text-section-title text-foreground">Top buttons</h2>
          <p className="mb-3 text-caption text-muted">
            Counts how often each button was clicked — not whether the action was completed.
          </p>
          <RankedBars data={topBlocks.map((b) => ({ label: b.label, value: b.count }))} />
        </Card>
      </div>
    </>
  );
}
