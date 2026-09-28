import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { minTapTarget, radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Text, type TextTone } from "./text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Shows a spinner and blocks presses; `loadingLabel` replaces the label meanwhile. */
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * One primary action per screen (brief); everything else is secondary or ghost.
 * At least 48 dp tall. Pressed and busy states change colour, not size, so
 * nothing moves under a thumb.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  loadingLabel,
  disabled = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const shown = loading && loadingLabel ? loadingLabel : label;

  const look: Record<
    ButtonVariant,
    { fill: string; pressed: string; border: string; tone: TextTone }
  > = {
    primary: {
      fill: colors.accentFill,
      pressed: colors.accentFillPressed,
      border: colors.accentFill,
      tone: "onAccentFill",
    },
    secondary: {
      fill: colors.surface,
      pressed: colors.surfaceSunken,
      border: colors.borderStrong,
      tone: "foreground",
    },
    ghost: {
      fill: "transparent",
      pressed: colors.surfaceSunken,
      border: "transparent",
      tone: "accentText",
    },
    danger: {
      fill: colors.surface,
      pressed: colors.dangerSoft,
      border: colors.danger,
      tone: "dangerText",
    },
  };
  const v = look[variant];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={shown}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? v.pressed : v.fill,
          borderColor: v.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={colors[v.tone]} /> : null}
        <Text variant="cardTitle" tone={v.tone}>
          {shown}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
});
