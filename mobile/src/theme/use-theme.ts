import { useColorScheme } from "react-native";
import { darkColors, lightColors, type ColorTokens } from "./tokens";

export type Scheme = "light" | "dark";

export type Theme = {
  scheme: Scheme;
  colors: ColorTokens;
};

/**
 * The app follows the phone's light or dark setting (D-041) and re-renders
 * when it changes. Anything the phone cannot tell us is treated as light.
 */
export function useTheme(): Theme {
  const scheme: Scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: scheme === "dark" ? darkColors : lightColors };
}
