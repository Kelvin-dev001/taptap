/**
 * Design tokens — the web's, carried over (docs/mobile/PLAN.md §4.8).
 *
 * Light values are copied from app/globals.css, and tokens.test.ts fails if
 * any of them drifts from the web. Dark values are new: the web is light-only
 * for its phase (CLAUDE.md §8), the app follows the phone (D-041).
 *
 * D-012 carries over: vivid orange (#F97316) only ever fills something that
 * carries no text. Orange behind a label, or orange as text, uses a darker step.
 */

/** The brand ramp, identical to --color-primary-50 … 950 on the web. */
export const orange = {
  50: "#fff7ed",
  100: "#ffedd5",
  200: "#fed7aa",
  300: "#fdba74",
  400: "#fb923c",
  500: "#f97316",
  600: "#ea6a0c",
  700: "#c2560a",
  800: "#9a4508",
  900: "#7c3806",
  950: "#431c02",
} as const;

export type ColorTokens = {
  // Brand roles shared with the web (--color-primary-*).
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryStrong: string;
  primaryStrongHover: string;
  primarySoft: string;
  primarySubtle: string;
  // Surfaces
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  surfaceInverse: string;
  surfaceInverseElevated: string;
  // Text
  foreground: string;
  foregroundSecondary: string;
  muted: string;
  onInverse: string;
  onInverseMuted: string;
  // Lines
  border: string;
  borderStrong: string;
  // States
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  // App-only roles. They exist because a phone renders colour in places the
  // web never does — on the page background, on badge fills, in dark mode.
  /** Orange text and icons on any background. */
  accentText: string;
  /**
   * Red text: errors, destructive labels, badges. `danger` stays for icons,
   * borders and fills, which need 3:1; as text on its own badge fill the web's
   * red is 4.41:1, short of AA.
   */
  dangerText: string;
  /** The fill of a primary button. */
  accentFill: string;
  /** Label colour on accentFill. */
  onAccentFill: string;
  /** Pressed state of accentFill. */
  accentFillPressed: string;
};

export const lightColors: ColorTokens = {
  primary: orange[500],
  primaryHover: orange[600],
  primaryActive: orange[700],
  primaryStrong: orange[700],
  primaryStrongHover: orange[800],
  primarySoft: "#fff1e6",
  primarySubtle: "#fffaf5",
  background: "#fbfbfa",
  surface: "#ffffff",
  surfaceElevated: "#ffffff",
  surfaceSunken: "#f5f5f4",
  surfaceInverse: "#141414",
  surfaceInverseElevated: "#1f1f1f",
  foreground: "#0f0f0f",
  foregroundSecondary: "#525252",
  muted: "#737373",
  onInverse: "#fafafa",
  onInverseMuted: "#a3a3a3",
  border: "#eaeaea",
  borderStrong: "#d4d4d4",
  success: "#15803d",
  successSoft: "#f0fdf4",
  warning: "#b45309",
  warningSoft: "#fffbeb",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  info: "#1d4ed8",
  infoSoft: "#eff6ff",
  // The web's orange text, #C2560A, is 4.54:1 on white but 4.38:1 on the
  // #FBFBFA page background — short of AA for body text. The next step of the
  // ramp passes on every light surface (contrast.test.ts).
  accentText: orange[800],
  dangerText: "#b91c1c",
  accentFill: orange[700],
  onAccentFill: "#ffffff",
  accentFillPressed: orange[800],
};

export const darkColors: ColorTokens = {
  primary: orange[500],
  primaryHover: orange[400],
  primaryActive: orange[600],
  // On dark surfaces the orange lightens rather than darkens.
  primaryStrong: orange[400],
  primaryStrongHover: orange[300],
  primarySoft: "#2a1a0e",
  primarySubtle: "#1c130c",
  background: "#0f0f0f",
  surface: "#171717",
  surfaceElevated: "#1f1f1f",
  surfaceSunken: "#0a0a0a",
  // The web's inverse surfaces are charcoal feature cards on a light page. In
  // dark mode they stay a raised charcoal rather than flipping to white.
  surfaceInverse: "#262626",
  surfaceInverseElevated: "#2e2e2e",
  foreground: "#fafafa",
  foregroundSecondary: "#d4d4d4",
  muted: "#a3a3a3",
  onInverse: "#fafafa",
  onInverseMuted: "#a3a3a3",
  border: "#262626",
  borderStrong: "#404040",
  success: "#4ade80",
  successSoft: "#0f2a1a",
  warning: "#fbbf24",
  warningSoft: "#2a200a",
  danger: "#f87171",
  dangerSoft: "#2a1111",
  info: "#60a5fa",
  infoSoft: "#0f1b2e",
  accentText: orange[400],
  dangerText: "#f87171",
  // D-012: vivid orange with near-black text (6.7:1), never white on orange.
  accentFill: orange[500],
  onAccentFill: "#111111",
  accentFillPressed: orange[600],
};

/** 4-point spacing scale. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/** The web's radii (tailwind.config.ts). */
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 999,
} as const;

/** The web's motion durations, in ms (--duration-fast / base / slow). */
export const duration = {
  fast: 120,
  base: 180,
  slow: 240,
} as const;

/** WCAG 2.5.8 asks for 24; Android and the brief ask for 48. */
export const minTapTarget = 48;
