import { describe, expect, it } from "vitest";
import { normalizeSlug, validateSlug } from "./slug";

describe("normalizeSlug", () => {
  it("lowercases and trims", () => {
    expect(normalizeSlug("  MyCafe  ")).toBe("mycafe");
  });
  it("converts spaces and underscores to hyphens", () => {
    expect(normalizeSlug("java house nairobi")).toBe("java-house-nairobi");
    expect(normalizeSlug("java_house")).toBe("java-house");
  });
  it("collapses repeated and trims edge hyphens", () => {
    expect(normalizeSlug("--java---house--")).toBe("java-house");
  });
  it("strips invalid characters", () => {
    expect(normalizeSlug("café@nairobi!")).toBe("cafnairobi");
  });
});

describe("validateSlug", () => {
  it("accepts a clean slug", () => {
    const r = validateSlug("java-house");
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.slug).toBe("java-house");
  });
  it("normalizes then accepts mixed input", () => {
    const r = validateSlug("Java House Nairobi");
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.slug).toBe("java-house-nairobi");
  });
  it("rejects too-short slugs", () => {
    expect(validateSlug("ab").valid).toBe(false);
  });
  it("rejects too-long slugs", () => {
    expect(validateSlug("a".repeat(41)).valid).toBe(false);
  });
  it("rejects reserved slugs", () => {
    expect(validateSlug("dashboard").valid).toBe(false);
    expect(validateSlug("Admin").valid).toBe(false);
    expect(validateSlug("taptap").valid).toBe(false);
  });
  it("rejects input that normalizes to empty", () => {
    expect(validateSlug("!!!").valid).toBe(false);
  });
});
