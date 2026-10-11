import { StyleSheet, View } from "react-native";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Text, type TextTone } from "./text";

export type BadgeTone = "success" | "warning" | "neutral" | "danger";

/**
 * A short status word with a dot. The word carries the meaning; the colour
 * only reinforces it (WCAG 1.4.1).
 */
export function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  const { colors } = useTheme();
  const look: Record<BadgeTone, { fill: string; dot: string; ink: TextTone }> = {
    success: { fill: colors.successSoft, dot: colors.success, ink: "success" },
    warning: { fill: colors.warningSoft, dot: colors.warning, ink: "warning" },
    neutral: { fill: colors.surfaceSunken, dot: colors.muted, ink: "foregroundSecondary" },
    danger: { fill: colors.dangerSoft, dot: colors.danger, ink: "dangerText" },
  };
  const { fill, dot, ink } = look[tone];
  return (
    <View style={[styles.badge, { backgroundColor: fill }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text variant="caption" weight="semibold" tone={ink}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs + 2,
    borderRadius: radius.full,
    paddingVertical: space.xxs,
    paddingHorizontal: space.sm + 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
