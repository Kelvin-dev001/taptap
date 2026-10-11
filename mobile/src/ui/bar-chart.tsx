import { StyleSheet, View } from "react-native";
import { formatNumber } from "@/i18n/format";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Text } from "./text";

/**
 * Bars in a row — a day, an hour — drawn with plain views. No animation at
 * all, so there is nothing for "reduce motion" to switch off, and nothing to
 * load. A screen reader hears the summary the screen passes in, not 30 bars.
 */
export function BarChart({
  values,
  summary,
  startLabel,
  endLabel,
  height = 120,
  highlight,
}: {
  values: number[];
  /** What the chart says, in one sentence, for screen readers. */
  summary: string;
  startLabel?: string;
  endLabel?: string;
  height?: number;
  /** Indexes drawn in the accent colour (the busiest hours). */
  highlight?: Set<number>;
}) {
  const { colors } = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View style={[styles.bars, { height }]}>
        {values.map((v, i) => (
          <View key={i} style={styles.slot}>
            <View
              style={[
                styles.bar,
                {
                  // A visible stub for zero, so an empty day reads as a day.
                  height: v === 0 ? 2 : Math.max(3, (v / max) * height),
                  backgroundColor: v === 0 ? colors.border : highlight?.has(i) ? colors.accentFill : colors.foregroundSecondary,
                },
              ]}
            />
          </View>
        ))}
      </View>
      {startLabel || endLabel ? (
        <View style={styles.axis}>
          <Text variant="caption" tone="muted">
            {startLabel}
          </Text>
          <Text variant="caption" tone="muted">
            {endLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Labelled bars, longest first — how visitors arrived, which card, which action. */
export function RankedBars({ rows, emptyLabel }: { rows: { label: string; value: number; hint?: string }[]; emptyLabel: string }) {
  const { colors } = useTheme();
  if (rows.length === 0) {
    return (
      <Text variant="bodySm" tone="muted">
        {emptyLabel}
      </Text>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={styles.ranked}>
      {rows.map((row, i) => (
        <View
          key={`${row.label}-${i}`}
          accessible
          accessibilityLabel={[row.label, String(row.value), row.hint].filter(Boolean).join(", ")}
          style={styles.rankedRow}
        >
          <View style={styles.rankedText}>
            <Text variant="bodySm" numberOfLines={1} style={styles.flex}>
              {row.label}
            </Text>
            <Text variant="bodySm" weight="semibold" style={styles.tabular}>
              {formatNumber(row.value)}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceSunken }]}>
            <View style={[styles.fill, { width: `${(row.value / max) * 100}%`, backgroundColor: colors.accentFill }]} />
          </View>
          {row.hint ? (
            <Text variant="caption" tone="muted">
              {row.hint}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  slot: { flex: 1, justifyContent: "flex-end" },
  bar: { borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xs },
  ranked: { gap: space.md },
  rankedRow: { gap: space.xs },
  rankedText: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  track: { height: 6, borderRadius: radius.full, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.full },
});
