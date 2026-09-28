import { Platform, type TextStyle } from "react-native";

/**
 * Inter, embedded at build time by the expo-font config plugin (app.config.ts).
 *
 * Each weight is its own file. iOS finds a font by its PostScript name and
 * Android by its file name, so a weight maps to an explicit family on each
 * platform. fontWeight is deliberately never set alongside it: on Android that
 * asks the system to synthesise a bold on top of an already-bold face.
 */
export type Weight = "regular" | "medium" | "semibold" | "bold";

const FAMILIES: Record<Weight, { ios: string; android: string }> = {
  regular: { ios: "Inter-Regular", android: "Inter_400Regular" },
  medium: { ios: "Inter-Medium", android: "Inter_500Medium" },
  semibold: { ios: "Inter-SemiBold", android: "Inter_600SemiBold" },
  bold: { ios: "Inter-Bold", android: "Inter_700Bold" },
};

export function fontFamily(weight: Weight): string {
  const family = FAMILIES[weight];
  return Platform.OS === "ios" ? family.ios : family.android;
}

type Role = {
  size: number;
  lineHeight: number;
  weight: Weight;
  /** In points. The web states tracking in em; these are converted at the role's size. */
  letterSpacing?: number;
  /** Tabular figures, so numbers do not jitter as they change (D-014). */
  tabular?: boolean;
};

/** The web's type roles (tailwind.config.ts `fontSize`), one to one. */
export const typeRoles = {
  display: { size: 36, lineHeight: 40, weight: "bold", letterSpacing: -0.72 },
  pageTitle: { size: 24, lineHeight: 32, weight: "semibold", letterSpacing: -0.36 },
  sectionTitle: { size: 18, lineHeight: 28, weight: "semibold", letterSpacing: -0.18 },
  cardTitle: { size: 15, lineHeight: 22, weight: "semibold" },
  body: { size: 15, lineHeight: 24, weight: "regular" },
  bodySm: { size: 14, lineHeight: 22, weight: "regular" },
  label: { size: 12, lineHeight: 16, weight: "medium", letterSpacing: 0.72 },
  caption: { size: 12, lineHeight: 18, weight: "regular" },
  metric: { size: 30, lineHeight: 36, weight: "bold", letterSpacing: -0.6, tabular: true },
  metricLg: { size: 40, lineHeight: 44, weight: "bold", letterSpacing: -1, tabular: true },
} as const satisfies Record<string, Role>;

export type TypeRole = keyof typeof typeRoles;

export function textStyle(role: TypeRole): TextStyle {
  const r: Role = typeRoles[role];
  return {
    fontFamily: fontFamily(r.weight),
    fontSize: r.size,
    lineHeight: r.lineHeight,
    letterSpacing: r.letterSpacing,
    fontVariant: r.tabular ? ["tabular-nums"] : undefined,
  };
}
