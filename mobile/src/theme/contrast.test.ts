import { AA_LARGE, AA_TEXT, contrastRatio } from "./contrast";
import { darkColors, lightColors, type ColorTokens } from "./tokens";

/**
 * Contrast is a test, not a promise (CLAUDE.md §24, WCAG 2.2 AA). Every text
 * colour is held to 4.5:1 on every surface it can sit on, in both themes.
 */

type Pair = [text: keyof ColorTokens, background: keyof ColorTokens, minimum: number];

/**
 * Surfaces that carry text. `surfaceSunken` is not one of them: it is for
 * skeletons and wells, and the web's muted grey on it is 4.35:1 — so only the
 * two darkest text colours are allowed there (checked below).
 */
const textSurfaces: (keyof ColorTokens)[] = ["background", "surface", "surfaceElevated"];

const bodyText: (keyof ColorTokens)[] = [
  "foreground",
  "foregroundSecondary",
  "muted",
  "accentText",
  "dangerText",
  "success",
  "warning",
  "info",
];

const pairs: Pair[] = [
  ...bodyText.flatMap((text) => textSurfaces.map((bg): Pair => [text, bg, AA_TEXT])),
  ["foreground", "surfaceSunken", AA_TEXT],
  ["foregroundSecondary", "surfaceSunken", AA_TEXT],
  // Badges: state text on its own soft fill.
  ["success", "successSoft", AA_TEXT],
  ["warning", "warningSoft", AA_TEXT],
  ["dangerText", "dangerSoft", AA_TEXT],
  ["info", "infoSoft", AA_TEXT],
  ["accentText", "primarySoft", AA_TEXT],
  // Red icons and borders are UI components: 3:1.
  ["danger", "background", AA_LARGE],
  ["danger", "surface", AA_LARGE],
  // Buttons: the label on its fill, resting and pressed.
  ["onAccentFill", "accentFill", AA_TEXT],
  ["onAccentFill", "accentFillPressed", AA_TEXT],
  // Feature cards.
  ["onInverse", "surfaceInverse", AA_TEXT],
  ["onInverseMuted", "surfaceInverse", AA_TEXT],
  ["onInverse", "surfaceInverseElevated", AA_TEXT],
  // A state a person must see — a switch that is on, the selected tab — is a UI
  // component and needs 3:1 against its surroundings (WCAG 1.4.11). Vivid
  // orange cannot carry that on white (2.8:1), so states use accentFill and the
  // vivid orange stays decoration beside another cue.
  ["accentFill", "background", AA_LARGE],
  ["accentFill", "surface", AA_LARGE],
];

describe.each([
  ["light", lightColors],
  ["dark", darkColors],
] as const)("%s theme", (_name, colors) => {
  it.each(pairs)("%s on %s ≥ %s:1", (text, background, minimum) => {
    expect(contrastRatio(colors[text], colors[background])).toBeGreaterThanOrEqual(minimum);
  });
});

describe("contrastRatio", () => {
  it("matches the published WCAG extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("reproduces D-012's figure: white on the brand orange fails", () => {
    expect(contrastRatio("#ffffff", "#f97316")).toBeCloseTo(2.8, 1);
  });

  it("explains accentText: the web's orange text passes on white, not on the page background", () => {
    expect(contrastRatio("#c2560a", "#ffffff")).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio("#c2560a", "#fbfbfa")).toBeLessThan(AA_TEXT);
  });

  it("vivid orange is decoration, never a lone indicator", () => {
    expect(contrastRatio("#f97316", "#ffffff")).toBeLessThan(AA_LARGE);
  });
});
