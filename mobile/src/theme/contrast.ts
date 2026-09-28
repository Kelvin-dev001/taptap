/**
 * WCAG 2.x contrast, computed rather than remembered.
 *
 * The same relative-luminance maths as `onAccentColor` in lib/profile.ts,
 * returned as a ratio so tests can hold every token pairing to a number.
 */

function channel(hex2: string): number {
  const v = parseInt(hex2, 16) / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return (
    0.2126 * channel(full.slice(0, 2)) +
    0.7152 * channel(full.slice(2, 4)) +
    0.0722 * channel(full.slice(4, 6))
  );
}

/** Contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG AA: 4.5:1 for body text; 3:1 for large text, icons and UI boundaries. */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;
