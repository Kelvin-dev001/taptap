import { Pressable, StyleSheet } from "react-native";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Text } from "./text";

/**
 * One filter in a row of filters — "New 4". Selected is shown by fill and a
 * heavier label, and announced as selected; never by colour alone.
 */
export function Chip({
  label,
  count,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.surfaceInverse : pressed ? colors.surfaceSunken : colors.surface,
          borderColor: selected ? colors.surfaceInverse : colors.borderStrong,
        },
      ]}
    >
      <Text variant="bodySm" weight={selected ? "semibold" : "medium"} tone={selected ? "onInverse" : "foreground"}>
        {count === undefined ? label : `${label} ${count}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space.md,
    justifyContent: "center",
  },
});
