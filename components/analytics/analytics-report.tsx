import Link from "next/link";
import { Nfc } from "lucide-react";
import { Card, MetricCard, Alert, Badge } from "@/components/ui";
import { ChartContainer } from "@/components/charts/chart-container";
import { BarChart, RankedBars, type Series } from "@/components/charts/bar-chart";
import {
  type Analytics,
  pageOpens,
  engagementCount,
  confirmedCount,
  confirmedRate,
  engagementRate,
  sourceLabel,
  countryLabel,
  hourLabel,
  busiestWindow,
} from "@/lib/analytics";
import {
  percentChange,
  isNewActivity,
  comparisonLabel,
  rangeLabel,
  blockClickPhrase,
  METRIC_LABELS,
  METRIC_HINTS,
  type RangeDays,
  type EventType,
} from "@/lib/metrics";

const DAY_SERIES: Series[] = [
  { key: "opens", label: "Page opens", color: "var(--color-primary)" },
  { key: "click", label: "Clicks", color: "#1d4ed8" },
  { key: "confirmed", label: "Confirmed", color: "#15803d" },
];

const HOUR_SERIES: Series[] = [
  { key: "count", label: "Activity", color: "var(--color-primary)" },
];

/**
 * The analytics report, shared by the account view and the per-profile view so
 * the two cannot drift apart the way they did before UI-7.
 *
 * Its organising idea is CLAUDE.md §15: separate what we saw from what we can
 * prove. Reach and clicks are observations; only saved contacts and submitted
 * leads are outcomes, because those happen inside our own code.
 */
export function AnalyticsReport({
  data,
  days,
  showPages,
  depth = "full",
}: {
  data: Analytics;
  days: RangeDays;
  showPages?: boolean;
  /**
   * How much of the report this account is entitled to (D-018). `basic` keeps
   * the headline counts, the daily trend and top actions — enough to see that
   * the product works. `full` adds attribution, per-card, location and timing,
   * which is what a device unlocks.
   */
  depth?: "basic" | "full";
}) {
  const full = depth === "full";
  const totals = data.totals ?? {};
  const previous = data.previous ?? {};

  const opens = pageOpens(totals);
  const clicks = engagementCount(totals);
  const confirmed = confirmedCount(totals);
  const rate = confirmedRate(totals);
  const engRate = engagementRate(totals);

  const metricFor = (key: EventType) => {
    const value = key === "lead" ? data.leads : (totals[key] ?? 0);
    const prev = key === "lead" ? data.previous_leads : (previous[key] ?? 0);
    return { value, prev };
  };

  const busiest = busiestWindow(data.by_hour ?? []);
  const hasUnknownSource = (data.by_source ?? []).some((s) => s.source === "unknown");

  return (
    <div className="flex flex-col gap-4">
      {/* Reach */}
      <section aria-label="Reach" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(["tap", "scan", "view", "click", "download", "lead"] as EventType[]).map((key) => {
          const { value, prev } = metricFor(key);
          return (
            <MetricCard
              key={key}
              label={METRIC_LABELS[key]}
              value={value.toLocaleString()}
              delta={percentChange(value, prev)}
              deltaLabel={comparisonLabel(days)}
              isNew={isNewActivity(value, prev)}
              hint={METRIC_HINTS[key]}
            />
          );
        })}
      </section>

      {/* What we can prove */}
      <Card padding="md">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-section-title text-foreground">Clicks and confirmed actions</h2>
        </div>
        <p className="mb-4 text-caption text-muted">
          A click means a button was pressed and the visitor left for another app or site. We
          cannot see what happened next — so a review click is not a review, and a WhatsApp
          click is not a message. Only saved contacts and submitted leads complete inside
          TapTap, so those are the only outcomes reported as confirmed.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Page opens"
            value={opens.toLocaleString()}
            note="Views and QR scans. Excludes NFC taps, which also record a view."
          />
          <Stat
            label="Clicked something"
            value={clicks.toLocaleString()}
            note={engRate === undefined ? "No page opens yet" : `${engRate.toFixed(1)}% of opens`}
          />
          <Stat
            label="Confirmed actions"
            value={confirmed.toLocaleString()}
            note={
              rate === undefined
                ? "No page opens yet"
                : `${rate.toFixed(1)}% of opens · contacts saved and leads`
            }
            emphasis
          />
        </div>
      </Card>

      {/* Trend */}
      <ChartContainer
        title="Activity by day"
        note={rangeLabel(days)}
        series={DAY_SERIES}
      >
        <BarChart
          data={(data.daily ?? []).map((d) => ({
            label: d.date,
            values: {
              opens: d.view + d.scan,
              click: d.click,
              confirmed: d.download + d.lead,
            },
          }))}
          series={DAY_SERIES}
          labelFormat="date"
        />
      </ChartContainer>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* How people arrived */}
        {full && (
        <Card padding="md">
          <h2 className="mb-1 text-card-title text-foreground">How visitors arrived</h2>
          <p className="mb-4 text-caption text-muted">
            NFC, QR and direct links, split by what actually produced the visit.
          </p>
          <RankedBars
            data={(data.by_source ?? []).map((s) => ({
              label: sourceLabel(s.source),
              value: s.count,
            }))}
          />
          {hasUnknownSource && (
            <p className="mt-3 text-caption text-muted">
              &ldquo;Not recorded&rdquo; is activity from before source tracking was added. It is
              left unattributed rather than guessed at.
            </p>
          )}
        </Card>
        )}

        {/* Which physical card */}
        {full && (
        <Card padding="md">
          <h2 className="mb-1 text-card-title text-foreground">Which card</h2>
          <p className="mb-4 text-caption text-muted">
            Taps attributed to a specific NFC card.
          </p>
          {(data.by_device ?? []).length === 0 ? (
            <p className="flex items-center gap-2 py-4 text-body-sm text-muted">
              <Nfc className="h-4 w-4" aria-hidden="true" />
              No card-attributed taps yet.
            </p>
          ) : (
            <RankedBars
              data={data.by_device.map((d) => ({
                label: d.label || `Card ···${d.token.slice(-6)}`,
                value: d.count,
              }))}
            />
          )}
        </Card>
        )}

        {/* Most-clicked */}
        <Card padding="md">
          <h2 className="mb-1 text-card-title text-foreground">Most-clicked actions</h2>
          <p className="mb-4 text-caption text-muted">
            Counts clicks — not whether the action was completed.
          </p>
          <RankedBars
            data={(data.top_blocks ?? []).map((b) => ({
              label: b.label,
              value: b.count,
              hint: blockClickPhrase(b.type),
            }))}
          />
        </Card>

        {/* Where */}
        {full && (
        <Card padding="md">
          <h2 className="mb-1 text-card-title text-foreground">Where visitors are</h2>
          <p className="mb-4 text-caption text-muted">
            Approximate, from network location. Never precise, and no personal data is stored.
          </p>
          <RankedBars
            data={(data.by_country ?? []).map((c) => ({
              label: countryLabel(c.country),
              value: c.count,
            }))}
          />
        </Card>
        )}
      </div>

      {/* Time of day */}
      {full && (
      <ChartContainer
        title="When visitors tap"
        note="Hour of day, East Africa Time (UTC+3)"
        series={HOUR_SERIES}
        actions={
          busiest && (
            <Badge variant="brand">
              Busiest {hourLabel(busiest.startHour)}–{hourLabel(busiest.endHour)}
            </Badge>
          )
        }
      >
        <BarChart
          data={Array.from({ length: 24 }, (_, hour) => ({
            label: hourLabel(hour),
            values: {
              count: (data.by_hour ?? []).find((h) => h.hour === hour)?.count ?? 0,
            },
          }))}
          series={HOUR_SERIES}
          height={140}
        />
        {busiest && (
          <p className="mt-3 text-caption text-muted">
            {busiest.share.toFixed(0)}% of activity happens between{" "}
            {hourLabel(busiest.startHour)} and {hourLabel(busiest.endHour)}. Times are East
            Africa Time — per-account time zones arrive with expansion beyond Kenya.
          </p>
        )}
      </ChartContainer>
      )}

      {/* Per profile */}
      {showPages && (data.top_pages ?? []).length > 0 && (
        <Card padding="md">
          <h2 className="mb-4 text-card-title text-foreground">By profile</h2>
          <ul className="flex flex-col divide-y divide-border">
            {data.top_pages.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <Link
                  href={`/dashboard/profiles/${p.id}/analytics`}
                  className="min-w-0 truncate text-body-sm text-foreground hover:text-primary-strong"
                >
                  {p.title || `/${p.slug}`}
                </Link>
                <span className="tabular shrink-0 text-body-sm text-muted">
                  {p.events.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {opens === 0 && clicks === 0 && (
        <Alert tone="info" title="No activity in this period">
          Share your link or tap a card to see numbers here. Try a longer range if this is a
          new profile.
        </Alert>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? "rounded-lg border border-success/20 bg-success-soft p-3"
          : "rounded-lg bg-surface-sunken p-3"
      }
    >
      <p className="text-label uppercase text-muted">{label}</p>
      <p className={`tabular mt-1 text-metric ${emphasis ? "text-success" : "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-1 text-caption text-muted">{note}</p>
    </div>
  );
}
