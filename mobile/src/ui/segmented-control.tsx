import { Pressable, StyleSheet, View } from "react-native";
import { minTapTarget, radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Text } from "./text";

type Option<T extends string> = { value: T; label: string };

/**
 * Two to four mutually exclusive options side by side — Light / Dark. Read as
 * a group of radio buttons, each with its selected state.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Names the group for screen readers. */
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.group, { backgroundColor: colors.surfaceSunken }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            style={[
              styles.option,
              selected
                ? { backgroundColor: colors.surface, borderColor: colors.borderStrong }
                : { borderColor: "transparent" },
            ]}
          >
            <Text variant="bodySm" weight={selected ? "semibold" : "regular"}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", borderRadius: radius.md, padding: space.xxs, gap: space.xxs },
  option: {
    flex: 1,
    minHeight: minTapTarget - 4,
    borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
