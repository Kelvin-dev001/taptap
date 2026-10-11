import { Pressable, Switch as NativeSwitch, StyleSheet, View } from "react-native";
import { minTapTarget, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Text } from "./text";

type SwitchRowProps = {
  label: string;
  /** Quiet second line, e.g. what switching it does. */
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/**
 * A labelled on/off switch. The whole row toggles, not just the thumb, and a
 * screen reader hears one control: the label, "switch", on or off.
 */
export function SwitchRow({ label, description, value, onValueChange, disabled = false }: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}
    >
      <View style={styles.text}>
        <Text variant="body">{label}</Text>
        {description ? (
          <Text variant="bodySm" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <NativeSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        // The row carries the label and state; the native switch is decoration
        // to a screen reader, so it is not announced twice.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        trackColor={{ false: colors.borderStrong, true: colors.accentFill }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.borderStrong}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTapTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  text: { flex: 1, gap: space.xxs },
});
