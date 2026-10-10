import { Pressable, StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { ChevronRight, type LucideIcon } from "./icons";
import { Text } from "./text";

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onPress?: () => void;
  accessibilityHint?: string;
};

/** One tappable line in a list: icon, words, and a chevron when it goes somewhere. */
export function ListRow({ title, subtitle, icon: Icon, onPress, accessibilityHint }: ListRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: colors.surfaceSunken } : null,
      ]}
    >
      {Icon ? <Icon size={20} color={colors.foregroundSecondary} /> : null}
      <View style={styles.text}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="bodySm" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={20} color={colors.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  text: { flex: 1, gap: space.xxs },
});
