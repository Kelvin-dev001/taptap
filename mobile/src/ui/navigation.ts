import { fontFamily } from "@/theme/typography";
import type { ColorTokens } from "@/theme/tokens";

/** Header look shared by every stack, so screens never style their own. */
export function stackScreenOptions(colors: ColorTokens) {
  return {
    contentStyle: { backgroundColor: colors.background },
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.foreground,
    headerTitleStyle: { fontFamily: fontFamily("semibold") },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal" as const,
  };
}
