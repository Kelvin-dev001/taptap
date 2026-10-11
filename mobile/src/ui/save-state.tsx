import { ActivityIndicator, StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Check, CircleAlert, CloudOff, RefreshCw, type LucideIcon } from "./icons";
import { Text, type TextTone } from "./text";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "retrying" | "problem";

/**
 * "Saving… → Saved ✓" (CLAUDE.md §10): an owner never has to guess whether a
 * change was kept. Read out politely as it changes.
 */
export function SaveState({ status, label }: { status: SaveStatus; label: string }) {
  const { colors } = useTheme();
  if (status === "idle") return null;

  const look: Record<Exclude<SaveStatus, "idle">, { icon: LucideIcon | null; tone: TextTone }> = {
    saving: { icon: null, tone: "muted" },
    saved: { icon: Check, tone: "success" },
    offline: { icon: CloudOff, tone: "foregroundSecondary" },
    retrying: { icon: RefreshCw, tone: "foregroundSecondary" },
    problem: { icon: CircleAlert, tone: "dangerText" },
  };
  const { icon: Icon, tone } = look[status];

  return (
    <View style={styles.row} accessibilityLiveRegion="polite" accessible accessibilityLabel={label}>
      {Icon ? (
        <Icon size={16} color={colors[tone]} />
      ) : (
        <ActivityIndicator size="small" color={colors.muted} />
      )}
      <Text variant="bodySm" tone={tone} style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.xs + 2 },
  text: { flexShrink: 1 },
});
