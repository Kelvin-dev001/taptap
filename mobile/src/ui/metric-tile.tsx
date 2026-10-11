import { useTranslation } from "react-i18next";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { formatNumber, formatPercent } from "@/i18n/format";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { ArrowDown, ArrowUp } from "./icons";
import { Text } from "./text";

/**
 * One number with its change against the previous period of the same length.
 * The change says up or down in words as well as with an arrow, and is absent —
 * not "0%" — when there was nothing before to compare with (lib/metrics.ts).
 */
export function MetricTile({
  label,
  value,
  change,
  isNew = false,
  hint,
  style,
}: {
  label: string;
  value: number;
  /** Percent change, or undefined when the previous period had nothing. */
  change: number | undefined;
  /** Activity this period after none in the last. */
  isNew?: boolean;
  hint?: string;
  /** Width overrides, e.g. three across instead of two. */
  style?: ViewStyle;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const up = change !== undefined && change > 0;
  const down = change !== undefined && change < 0;
  const changeText =
    change === undefined
      ? isNew
        ? t("metrics.new")
        : null
      : change === 0
        ? t("metrics.same")
        : t(up ? "metrics.up" : "metrics.down", { percent: formatPercent(change) });

  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
      accessible
      accessibilityLabel={[label, formatNumber(value), changeText, hint].filter(Boolean).join(". ")}
    >
      <Text variant="caption" tone="foregroundSecondary" numberOfLines={2}>
        {label}
      </Text>
      <Text variant="metric">{formatNumber(value)}</Text>
      {changeText ? (
        <View style={styles.change}>
          {up ? <ArrowUp size={14} color={colors.success} /> : null}
          {down ? <ArrowDown size={14} color={colors.foregroundSecondary} /> : null}
          <Text variant="caption" tone={up ? "success" : "foregroundSecondary"}>
            {changeText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: space.xxs,
  },
  change: { flexDirection: "row", alignItems: "center", gap: space.xxs },
});
