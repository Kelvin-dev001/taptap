import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { DEFAULT_THEME, onAccentColor } from "@taptap/core/profile";
import { minTapTarget, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Check } from "@/ui/icons";

/**
 * Button colours to choose from. A phone has no colour wheel worth using, and
 * ten good colours beat sixteen million for an owner in a hurry. A colour set
 * on the website that is not here stays, shown first as "Your colour".
 *
 * `hex`, not `value`: Reanimated's Babel plugin takes `.value` inside a
 * style for one of its shared values and injects a warning.
 */
export const ACCENTS = [
  { hex: DEFAULT_THEME.accent, name: "charcoal" },
  { hex: "#c2560a", name: "orange" },
  { hex: "#b91c1c", name: "red" },
  { hex: "#be185d", name: "pink" },
  { hex: "#7c3aed", name: "purple" },
  { hex: "#1d4ed8", name: "blue" },
  { hex: "#0e7490", name: "teal" },
  { hex: "#15803d", name: "green" },
  { hex: "#a16207", name: "gold" },
  { hex: "#525252", name: "grey" },
] as const;

type Name = (typeof ACCENTS)[number]["name"] | "yours";

export function ColourPicker({
  value,
  onChange,
  label,
}: {
  value: string | undefined;
  onChange: (accent: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const current = (value ?? DEFAULT_THEME.accent).toLowerCase();
  const options: { hex: string; name: Name }[] = ACCENTS.some((a) => a.hex === current)
    ? [...ACCENTS]
    : [{ hex: current, name: "yours" }, ...ACCENTS];

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.grid}>
      {options.map((option) => {
        const selected = option.hex === current;
        return (
          <Pressable
            key={option.hex}
            onPress={() => onChange(option.hex)}
            accessibilityRole="radio"
            accessibilityLabel={t(`colours.${option.name}`)}
            accessibilityState={{ selected, checked: selected }}
            style={styles.target}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: option.hex, borderColor: selected ? colors.foreground : colors.border },
                selected ? styles.selected : null,
              ]}
            >
              {selected ? <Check size={18} color={onAccentColor(option.hex)} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  target: { width: minTapTarget, height: minTapTarget, alignItems: "center", justifyContent: "center" },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { borderWidth: 3 },
});
