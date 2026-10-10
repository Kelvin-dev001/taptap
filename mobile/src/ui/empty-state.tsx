import { StyleSheet, View } from "react-native";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import type { LucideIcon } from "./icons";
import { Text } from "./text";

/** What a screen shows when there is nothing in it yet, and what comes next. */
export function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
        <Icon size={28} color={colors.accentText} />
      </View>
      <Text variant="sectionTitle" accessibilityRole="header" style={styles.center}>
        {title}
      </Text>
      <Text tone="foregroundSecondary" style={styles.center}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.huge,
    paddingHorizontal: space.lg,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  center: { textAlign: "center" },
});
