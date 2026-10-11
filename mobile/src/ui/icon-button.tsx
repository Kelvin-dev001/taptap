import { Pressable, StyleSheet } from "react-native";
import { minTapTarget, radius } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import type { LucideIcon } from "./icons";

type IconButtonProps = {
  icon: LucideIcon;
  /** Required: an icon alone says nothing to a screen reader. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
};

/** A 48 dp button that is only an icon — move up, move down, remove. */
export function IconButton({ icon: Icon, label, onPress, disabled = false, tone = "default" }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.surfaceSunken : "transparent", opacity: disabled ? 0.35 : 1 },
      ]}
    >
      <Icon size={20} color={tone === "danger" ? colors.danger : colors.foregroundSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: minTapTarget,
    height: minTapTarget,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
