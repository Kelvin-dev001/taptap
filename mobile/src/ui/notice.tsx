import { StyleSheet, View } from "react-native";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { CircleAlert, CircleCheck, Info, WifiOff, type LucideIcon } from "./icons";
import { Text } from "./text";

export type NoticeTone = "danger" | "info" | "success" | "offline";

/**
 * A short message inside a screen: a form error, "code sent", "you're offline".
 * An icon and words carry the meaning, never colour alone (WCAG 1.4.1).
 */
export function Notice({ tone, message }: { tone: NoticeTone; message: string }) {
  const { colors } = useTheme();
  const look: Record<NoticeTone, { icon: LucideIcon; fill: string; ink: string }> = {
    danger: { icon: CircleAlert, fill: colors.dangerSoft, ink: colors.dangerText },
    info: { icon: Info, fill: colors.infoSoft, ink: colors.info },
    success: { icon: CircleCheck, fill: colors.successSoft, ink: colors.success },
    offline: { icon: WifiOff, fill: colors.surfaceSunken, ink: colors.foregroundSecondary },
  };
  const { icon: Icon, fill, ink } = look[tone];

  return (
    <View
      style={[styles.box, { backgroundColor: fill }]}
      // Errors interrupt; everything else waits its turn.
      accessibilityRole={tone === "danger" ? "alert" : undefined}
      accessibilityLiveRegion={tone === "danger" ? "assertive" : "polite"}
    >
      <Icon size={18} color={ink} style={styles.icon} />
      <Text variant="bodySm" tone="foreground" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: space.sm,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  icon: { marginTop: 2 },
  text: { flex: 1 },
});
