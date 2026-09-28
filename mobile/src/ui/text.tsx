import { Text as NativeText, type TextProps as NativeTextProps } from "react-native";
import type { ColorTokens } from "@/theme/tokens";
import { textStyle, type TypeRole } from "@/theme/typography";
import { useTheme } from "@/theme/use-theme";

/** Colours that are safe as text (contrast.test.ts proves each one). */
export type TextTone = Extract<
  keyof ColorTokens,
  | "foreground"
  | "foregroundSecondary"
  | "muted"
  | "accentText"
  | "dangerText"
  | "success"
  | "warning"
  | "info"
  | "onAccentFill"
  | "onInverse"
  | "onInverseMuted"
>;

export type TextProps = NativeTextProps & {
  /** Typography role. Not `role`, which React Native keeps for accessibility. */
  variant?: TypeRole;
  tone?: TextTone;
};

/**
 * All text in the app. System font scaling stays on (allowFontScaling is
 * React Native's default); screens that cannot grow cap it with
 * maxFontSizeMultiplier rather than switching it off.
 */
export function Text({ variant = "body", tone = "foreground", style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <NativeText {...rest} style={[textStyle(variant), { color: colors[tone] }, style]} />;
}
