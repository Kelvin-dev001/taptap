import Link from "next/link";
import { IdCard, Plus, ArrowRight, Nfc, Check } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadBillingContext } from "@/lib/billing-context";
import { isGrandfathered } from "@/lib/entitlement";
import { HARDWARE_PRICE_KES, BUNDLED_MONTHS, formatKes } from "@/lib/pricing";
import {
  MetricCard,
  EmptyState,
  Card,
  Alert,
  buttonVariants,
} from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { Sparkline } from "@/components/charts/sparkline";
import { BarChart, RankedBars, type Series } from "@/components/charts/bar-chart";
import { ChartContainer } from "@/components/charts/chart-container";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { computeInsights, emptyReason, type InsightInputs } from "@/lib/insights";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import {
  percentChange,
  isNewActivity,
  parseRange,
  rangeLabel,
  comparisonLabel,
  blockClickPhrase,
  METRIC_LABELS,
  METRIC_HINTS,
  type DashboardOverview,
  type ActivityItem,
  type EventType,
} from "@/lib/metrics";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

/**
 * The dashboard for an account that has not activated anything yet (D-021).
 *
 * One job, stated once. Everything secondary is a text link rather than a
 * button, because two buttons of equal weight is the same as no primary action
 * at all — and the whole point of this screen is that there is exactly one
 * obvious next step.
 *
 * It does not hide the fact that they can build first. Being able to see what
 * you are buying before you buy it is the reason drafts exist, and burying that
 * would make the paywall feel like a wall rather than a switch.
 */
function ActivateCta({ draft }: { draft: { id: string; slug: string } | null }) {
  return (
    <div className="flex flex-col gap-4">
      <Card padding="lg" className="flex flex-col gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft">
          <Nfc className="h-5 w-5 text-primary-strong" aria-hidden="true" />
        </span>

        <div>
          <h2 className="text-page-title text-foreground">
            {draft ? "Your profile is ready to go live" : "Activate your Tap Profile"}
          </h2>
          <p className="mt-1 max-w-xl text-body text-foreground-secondary">
            {draft
              ? "It is saved as a draft, so only you can see it. A Smart Card or Smart Stand publishes it at your own link and makes it tappable."
              : "A Smart Card or Smart Stand is what makes your profile live and tappable. The price includes your first 12 months."}
          </p>
        </div>

        <ul className="flex flex-col gap-1.5">
          <Perk>Your page live at your own link, shareable anywhere</Perk>
          <Perk>Tap to open on any modern phone, with no app to install</Perk>
          <Perk>
            Change where it points at any time, without ever re-encoding the card
          </Perk>
          <Perk>Enquiry capture and the full report switch on</Perk>
        </ul>

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
          <Link href="/dashboard/checkout" className={cn(buttonVariants({ size: "lg" }))}>
            Buy your card
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="text-body-sm text-muted">
            From {formatKes(HARDWARE_PRICE_KES.card)}, including {BUNDLED_MONTHS} months.
          </p>
        </div>
      </Card>

      <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-foreground-secondary">
          {draft
            ? "Want to change something first? Keep building. Nothing is published until you activate."
            : "Prefer to see it first? Build your profile now and preview it. Nothing goes live until you activate."}
        </p>
        <Link
          href={draft ? `/dashboard/profiles/${draft.id}/edit` : "/dashboard/profiles"}
          className="shrink-0 text-body-sm font-medium text-primary-strong hover:underline"
        >
          {draft ? "Keep building" : "Build your profile"}
        </Link>
      </Card>
    </div>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body-sm text-foreground-secondary">
      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
      {children}
    </li>
  );
}

/** Taps lead: the tap is the product's core interaction. */
const HERO: EventType = "tap";
const SECONDARY: EventType[] = ["scan", "view", "click", "lead"];

const SPARK_COLORS: Record<string, string> = {
  scan: "#1d4ed8",
  view: "#7c3aed",
  click: "#15803d",
  lead: "#b45309",
};

const DAY_SERIES: Series[] = [
  { key: "tap", label: "Taps", color: "var(--color-primary)" },
  { key: "scan", label: "QR scans", color: "var(--color-border-strong)" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = parseRange(range);

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  const [
    { data: overviewData, error: overviewError },
    { data: activityData },
    { data: insightData },
    billing,
    { data: draftPages },
  ] = await Promise.all([
    supabase.rpc("get_dashboard_overview", { p_days: days }),
    supabase.rpc("get_recent_activity", { p_limit: 8 }),
    supabase.rpc("get_insight_inputs", { p_days: days }),
    loadBillingContext(supabase, profile?.account_id),
    supabase
      .from("smart_pages")
      .select("id, slug, status")
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const firstDraft = (draftPages ?? [])[0] as { id: string; slug: string } | undefined;

  // Migration 0008 introduces these RPCs. Until it is run they 404, and an
  // empty result would otherwise be indistinguishable from "no profiles yet" —
  // telling an owner with live cards to create their first link.
  if (isMissingSchemaError(overviewError)) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <MigrationNotice migration="0008_dashboard_rpcs.sql" />
      </>
    );
  }

  if (overviewError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Alert tone="danger" title="Could not load your dashboard">
          {overviewError.message}
        </Alert>
      </>
    );
  }

  const o = (overviewData ?? {}) as Partial<DashboardOverview>;
  const totals = o.totals ?? {};
  const previous = o.previous ?? {};
  const daily = o.daily ?? [];
  const activity = (activityData ?? []) as ActivityItem[];

  // Insights are computed from facts in lib/insights.ts, never in SQL, so the
  // rules stay testable and reviewable in one place. A missing RPC (migration
  // 0013 not yet run) simply means no panel rather than a broken dashboard.
  const insightInputs = (insightData ?? null) as InsightInputs | null;
  const insights = insightInputs ? computeInsights(insightInputs) : [];

  const valueOf = (key: EventType) =>
    key === "lead" ? (o.leads ?? 0) : (totals[key] ?? 0);
  const prevOf = (key: EventType) =>
    key === "lead" ? (o.previous_leads ?? 0) : (previous[key] ?? 0);

  const hasProfiles = (o.pages ?? 0) > 0;
  const heroValue = valueOf(HERO);
  const heroPrev = prevOf(HERO);

  // Whether anything on this account is actually live decides what this screen
  // is for (D-021). An account with no identity has no taps to report, and a
  // grid of zeroes reads as a broken product rather than an unactivated one —
  // so it gets one job instead: buy the card that turns the page on.
  const activated = billing.summary.active > 0 || billing.pages.some(isGrandfathered);

  if (!activated) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ActivateCta draft={firstDraft ?? null} />
      </>
    );
  }

  if (!hasProfiles) {
    return (
      <>
        <PageHeader title="Dashboard" />
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
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${rangeLabel(days)} · ${comparisonLabel(days)}`}
        actions={
          <>
            <RangeTabs value={days} />
            <Link href="/dashboard/profiles" className={cn(buttonVariants())}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New link
            </Link>
          </>
        }
      />

      {/* Cards fade up in sequence once on mount; reduced motion neutralises it. */}
      <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          className="animate-rise-in sm:col-span-2 lg:col-span-1"
          inverse
          label={METRIC_LABELS[HERO]}
          value={heroValue.toLocaleString()}
          delta={percentChange(heroValue, heroPrev)}
          deltaLabel={comparisonLabel(days)}
          isNew={isNewActivity(heroValue, heroPrev)}
          hint={METRIC_HINTS[HERO]}
          chart={
            <Sparkline data={daily.map((d) => d.tap)} stroke="var(--color-primary)" />
          }
        />

        {SECONDARY.map((key, i) => {
          const value = valueOf(key);
          const prev = prevOf(key);
          const seriesData =
            key === "lead" ? [] : daily.map((d) => d[key as "scan" | "view" | "click"]);
          return (
            <MetricCard
              key={key}
              className="animate-rise-in"
              style={{ animationDelay: `${(i + 1) * 40}ms` }}
              label={METRIC_LABELS[key]}
              value={value.toLocaleString()}
              delta={percentChange(value, prev)}
              deltaLabel={comparisonLabel(days)}
              isNew={isNewActivity(value, prev)}
              chart={
                seriesData.length > 0 ? (
                  <Sparkline data={seriesData} stroke={SPARK_COLORS[key]} />
                ) : undefined
              }
            />
          );
        })}
      </section>

      {insightInputs && (
        <div className="mt-4">
          <InsightsPanel
            insights={insights}
            emptyReason={emptyReason(insightInputs)}
            hasDismissed={(insightInputs.dismissed ?? []).length > 0}
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartContainer
          title="Taps and scans by day"
          note={rangeLabel(days)}
          series={DAY_SERIES}
          className="lg:col-span-2"
        >
          <BarChart
            data={daily.map((d) => ({
              label: d.date,
              values: { tap: d.tap, scan: d.scan },
            }))}
            series={DAY_SERIES}
            labelFormat="date"
          />
        </ChartContainer>

        <Card padding="md">
          <h2 className="mb-1 text-card-title text-foreground">Recent activity</h2>
          <p className="mb-4 text-caption text-muted">
            Leads, saved contacts and button clicks.
          </p>
          <ActivityFeed items={activity} />
        </Card>

        <Card padding="md">
          <h2 className="mb-1 text-card-title text-foreground">Most-clicked actions</h2>
          <p className="mb-4 text-caption text-muted">
            Counts clicks — not whether the action was completed.
          </p>
          <RankedBars
            data={(o.top_blocks ?? []).map((b) => ({
              label: b.label,
              value: b.count,
              hint: blockClickPhrase(b.type),
            }))}
          />
        </Card>

        <Card padding="md" className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-card-title text-foreground">Busiest profiles</h2>
            <Link
              href="/dashboard/analytics"
              className="inline-flex items-center gap-1 text-caption text-primary-strong hover:underline"
            >
              All analytics
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <RankedBars
            color="var(--color-primary-400)"
            data={(o.top_pages ?? []).map((p) => ({
              label: p.title || `/${p.slug}`,
              value: p.events,
            }))}
          />
        </Card>
      </div>
    </>
  );
}
