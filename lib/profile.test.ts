import { describe, it, expect } from "vitest";
import { onAccentColor, resolveTheme } from "./profile";

/**
 * Owners can pick any accent colour for their buttons. D-012 established that
 * white on the brand orange is 2.80:1 and fails AA — the same trap exists for
 * every light accent a customer might choose, so the label colour has to adapt.
 */
function contrast(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const ch = (i: number) => {
      const v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  };
  const a = lum(hexA);
  const b = lum(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("onAccentColor", () => {
  it("picks dark text on the brand orange, where white would fail", () => {
    expect(onAccentColor("#f97316")).toBe("#111111");
    expect(contrast("#f97316", "#111111")).toBeGreaterThanOrEqual(4.5);
  });

  it("picks white on dark accents", () => {
    expect(onAccentColor("#111827")).toBe("#ffffff");
    expect(onAccentColor("#15803d")).toBe("#ffffff");
  });

  it("picks dark on pale accents", () => {
    expect(onAccentColor("#fde047")).toBe("#111111");
    expect(onAccentColor("#ffffff")).toBe("#111111");
  });

  it("always reaches AA for normal text, whatever the accent", () => {
    const accents = [
      "#f97316", "#111827", "#ffffff", "#000000", "#fde047", "#15803d",
      "#1d4ed8", "#dc2626", "#7c3aed", "#a3a3a3", "#e5e5e5", "#4b5563",
    ];
    for (const accent of accents) {
      const text = onAccentColor(accent);
      expect(contrast(accent, text), `${accent} on ${text}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accepts shorthand hex and falls back safely on junk", () => {
    expect(onAccentColor("#fff")).toBe("#111111");
    expect(onAccentColor("not-a-colour")).toBe("#ffffff");
  });
});

describe("resolveTheme", () => {
  it("defaults to the light preset", () => {
    expect(resolveTheme(undefined)).toEqual({
      accent: "#111827",
      bg: "#ffffff",
      text: "#0a0a0a",
    });
  });

  it("flips surfaces for the dark preset", () => {
    const t = resolveTheme({ preset: "dark" });
    expect(t.bg).toBe("#0a0a0a");
    expect(t.text).toBe("#f5f5f5");
  });

  it("keeps a chosen accent in dark mode", () => {
    expect(resolveTheme({ preset: "dark", accent: "#f97316" }).accent).toBe("#f97316");
  });
});
