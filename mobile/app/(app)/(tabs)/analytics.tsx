import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { useAnalytics, type AnalyticsRange } from "@/api/analytics";
import {
  busiestWindow,
  confirmedCount,
  confirmedRate,
  countryLabel,
  engagementCount,
  engagementRate,
  hourLabel,
  pageOpens,
  type Analytics,
} from "@taptap/core/analytics";
import { activeIdentityCount } from "@taptap/core/identity";
import { isNewActivity, percentChange, type EventType } from "@taptap/core/metrics";
import { entitlementsFor } from "@taptap/core/pricing";
import { actionLabel } from "@/features/profile/blocks";
import { useProfiles } from "@/features/profile/use-profiles";
import { formatDay, formatNumber, formatPercent } from "@/i18n/format";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { BarChart, RankedBars } from "@/ui/bar-chart";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { ErrorState } from "@/ui/error-state";
import { ChartColumn, Check, ChevronDown } from "@/ui/icons";
import { ListRow } from "@/ui/list-row";
import { MetricTile } from "@/ui/metric-tile";
import { Notice } from "@/ui/notice";
import { OfflineBanner } from "@/ui/offline-banner";
import { Screen } from "@/ui/screen";
import { SegmentedControl } from "@/ui/segmented-control";
import { Sheet } from "@/ui/sheet";
import { Skeleton } from "@/ui/skeleton";
import { Text } from "@/ui/text";

const METRICS: EventType[] = ["tap", "scan", "view", "click", "download", "lead"];

/**
 * Analytics (PLAN.md §6): the web's report for the same function and the same
 * arithmetic, so the numbers match the website exactly. Clicks are called
 * clicks — what happened after one is not something TapTap can see (CLAUDE.md
 * §15). Attribution, cards, places and hours need an active card (D-018), and
 * say so without any word about buying one (PLAN.md §3).
 */
export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId, pages, identities } = useProfiles();
  const [days, setDays] = useState<AnalyticsRange>(30);
  const [pageId, setPageId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const analytics = useAnalytics(userId, days, pageId);
  const full = entitlementsFor(activeIdentityCount(identities)).analytics === "full";
  const profiles = pages.data ?? [];
  const chosen = profiles.find((p) => p.id === pageId);

  return (
    <Screen refreshing={analytics.isRefetching} onRefresh={() => void analytics.refetch()}>
      <OfflineBanner message={t("offline.app")} />
      <SegmentedControl
        label={t("analytics.rangeLabel")}
        options={[
          { value: "7", label: t("analytics.range7") },
          { value: "30", label: t("analytics.range30") },
          { value: "90", label: t("analytics.range90") },
        ]}
        value={String(days)}
        onChange={(v) => setDays(Number(v) as AnalyticsRange)}
      />
      {profiles.length > 1 ? (
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t("analytics.scopeLabel")}: ${chosen?.title || (chosen ? t("analytics.untitled") : t("analytics.allProfiles"))}`}
          accessibilityHint={t("analytics.chooseProfile")}
          style={styles.scope}
        >
          <Text variant="bodySm" weight="medium" tone="accentText">
            {chosen ? chosen.title || t("analytics.untitled") : t("analytics.allProfiles")}
          </Text>
          <ChevronDown size={18} color={colors.accentText} />
        </Pressable>
      ) : null}
      <Text variant="caption" tone="muted">
        {t("analytics.comparison", { days })}
      </Text>

      {analytics.data ? (
        analytics.data.pages === 0 ? (
          <Card>
            <EmptyState icon={ChartColumn} title={t("analytics.emptyTitle")} body={t("analytics.emptyBody")} />
          </Card>
        ) : (
          <Report data={analytics.data} days={days} full={full} showPages={!pageId} />
        )
      ) : analytics.isError ? (
        <Card>
          <ErrorState message={t("analytics.loadError")} onRetry={() => void analytics.refetch()} />
        </Card>
      ) : (
        <View style={styles.tiles}>
          {METRICS.map((m) => (
            <View key={m} style={styles.skeletonTile}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={30} />
            </View>
          ))}
        </View>
      )}

      <Sheet visible={picking} title={t("analytics.chooseProfile")} onClose={() => setPicking(false)}>
        {[{ id: null, title: t("analytics.allProfiles") }, ...profiles.map((p) => ({ id: p.id, title: p.title || t("analytics.untitled") }))].map(
          (p) => (
            <ListRow
              key={p.id ?? "all"}
              title={p.title}
              icon={p.id === pageId ? Check : undefined}
              onPress={() => {
                setPageId(p.id);
                setPicking(false);
              }}
            />
          ),
        )}
      </Sheet>
    </Screen>
  );
}

function Report({ data, days, full, showPages }: { data: Analytics; days: number; full: boolean; showPages: boolean }) {
  const { t } = useTranslation();
  const totals = data.totals;
  const opens = pageOpens(totals);
  const clicks = engagementCount(totals);
  const confirmed = confirmedCount(totals);
  const rate = confirmedRate(totals);
  const engRate = engagementRate(totals);
  const busiest = busiestWindow(data.by_hour);

  const valueOf = (m: EventType) => (m === "lead" ? data.leads : (totals[m] ?? 0));
  const prevOf = (m: EventType) => (m === "lead" ? data.previous_leads : (data.previous[m] ?? 0));

  const dailyOpens = data.daily.map((d) => d.view + d.scan);
  const best = dailyOpens.reduce((b, v, i) => (v > dailyOpens[b] ? i : b), 0);
  const dailySummary =
    opens === 0
      ? t("analytics.dailySummaryNone", { days })
      : t("analytics.dailySummary", {
          total: formatNumber(opens),
          days,
          day: data.daily[best] ? formatDay(data.daily[best].date) : "",
          count: formatNumber(dailyOpens[best] ?? 0),
        });

  const hours = Array.from({ length: 24 }, (_, h) => data.by_hour.find((x) => x.hour === h)?.count ?? 0);
  const busiestHours = busiest
    ? new Set(Array.from({ length: busiest.endHour - busiest.startHour }, (_, i) => busiest.startHour + i))
    : undefined;

  return (
    <>
      <View style={styles.tiles}>
        {METRICS.map((m) => (
          <MetricTile
            key={m}
            label={t(`metrics.${m}.label`)}
            value={valueOf(m)}
            change={percentChange(valueOf(m), prevOf(m))}
            isNew={isNewActivity(valueOf(m), prevOf(m))}
            hint={t(`metrics.${m}.hint`)}
          />
        ))}
      </View>

      <Card>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t("analytics.proofTitle")}
        </Text>
        <Text variant="bodySm" tone="foregroundSecondary">
          {t("analytics.proofBody")}
        </Text>
        <Stat label={t("analytics.opens")} value={opens} note={t("analytics.opensNote")} />
        <Stat
          label={t("analytics.clicked")}
          value={clicks}
          note={engRate === undefined ? t("analytics.noOpens") : t("analytics.ofOpens", { percent: formatPercent(engRate) })}
        />
        <Stat
          label={t("analytics.confirmed")}
          value={confirmed}
          note={rate === undefined ? t("analytics.noOpens") : t("analytics.ofOpens", { percent: formatPercent(rate) })}
        />
      </Card>

      <Card>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t("analytics.dailyTitle")}
        </Text>
        <BarChart
          values={dailyOpens}
          summary={dailySummary}
          startLabel={data.daily[0] ? formatDay(data.daily[0].date) : undefined}
          endLabel={data.daily.length ? formatDay(data.daily[data.daily.length - 1].date) : undefined}
        />
        <Text variant="bodySm" tone="muted">
          {dailySummary}
        </Text>
      </Card>

      <Card>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t("analytics.actionsTitle")}
        </Text>
        <Text variant="bodySm" tone="muted">
          {t("analytics.actionsBody")}
        </Text>
        <RankedBars
          rows={data.top_blocks.map((b) => ({
            // An action without a label comes back named by its type.
            label: b.label === b.type ? actionLabel(t, b.type) : b.label,
            value: b.count,
          }))}
          emptyLabel={t("analytics.noClicks")}
        />
      </Card>

      {full ? (
        <>
          <Card>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("analytics.arrivedTitle")}
            </Text>
            <Text variant="bodySm" tone="muted">
              {t("analytics.arrivedBody")}
            </Text>
            <RankedBars
              rows={data.by_source.map((s) => ({
                label: t(`analytics.sources.${(["nfc", "qr", "direct", "web"] as const).find((k) => k === s.source) ?? "unknown"}`),
                value: s.count,
              }))}
              emptyLabel={t("analytics.noActivityTitle")}
            />
            {data.by_source.some((s) => s.source === "unknown") ? (
              <Text variant="caption" tone="muted">
                {t("analytics.notRecorded")}
              </Text>
            ) : null}
          </Card>

          <Card>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("analytics.cardsTitle")}
            </Text>
            <Text variant="bodySm" tone="muted">
              {t("analytics.cardsBody")}
            </Text>
            <RankedBars
              rows={data.by_device.map((d) => ({
                label: d.label || t("analytics.card", { last: d.token.slice(-6) }),
                value: d.count,
              }))}
              emptyLabel={t("analytics.noCardTaps")}
            />
          </Card>

          <Card>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("analytics.hoursTitle")}
            </Text>
            <Text variant="caption" tone="muted">
              {t("analytics.hoursNote")}
            </Text>
            <BarChart
              values={hours}
              height={90}
              highlight={busiestHours}
              startLabel={hourLabel(0)}
              endLabel={hourLabel(23)}
              summary={
                busiest
                  ? t("analytics.hoursSummary", {
                      start: hourLabel(busiest.startHour),
                      end: hourLabel(busiest.endHour % 24),
                      share: formatPercent(busiest.share),
                    })
                  : t("analytics.hoursSummaryNone")
              }
            />
            {busiest ? (
              <Text variant="bodySm" tone="muted">
                {t("analytics.hoursSummary", {
                  start: hourLabel(busiest.startHour),
                  end: hourLabel(busiest.endHour % 24),
                  share: formatPercent(busiest.share),
                })}
              </Text>
            ) : null}
          </Card>

          <Card>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("analytics.whereTitle")}
            </Text>
            <Text variant="bodySm" tone="muted">
              {t("analytics.whereBody")}
            </Text>
            <RankedBars
              rows={data.by_country.map((c) => ({ label: countryLabel(c.country), value: c.count }))}
              emptyLabel={t("analytics.noPlaces")}
            />
          </Card>
        </>
      ) : (
        <Notice tone="info" message={t("analytics.basicNote")} />
      )}

      {showPages && data.top_pages.length > 1 ? (
        <Card>
          <Text variant="sectionTitle" accessibilityRole="header">
            {t("analytics.byProfileTitle")}
          </Text>
          <RankedBars
            rows={data.top_pages.map((p) => ({ label: p.title || t("analytics.untitled"), value: p.events }))}
            emptyLabel={t("analytics.noActivityTitle")}
          />
        </Card>
      ) : null}

      {opens === 0 && clicks === 0 ? (
        <Notice tone="info" message={`${t("analytics.noActivityTitle")}. ${t("analytics.noActivityBody")}`} />
      ) : null}
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${formatNumber(value)}. ${note}`}>
      <View style={styles.statTop}>
        <Text variant="body">{label}</Text>
        <Text variant="cardTitle">{formatNumber(value)}</Text>
      </View>
      <Text variant="caption" tone="muted">
        {note}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scope: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 48 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  skeletonTile: { flexBasis: "45%", flexGrow: 1, gap: space.sm, padding: space.md },
  stat: { gap: space.xxs },
  statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.md },
});
