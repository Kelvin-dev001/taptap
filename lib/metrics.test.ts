import { describe, it, expect } from "vitest";
import {
  percentChange,
  isNewActivity,
  relativeTime,
  parseRange,
  comparisonLabel,
  blockClickPhrase,
  activityPhrase,
  METRIC_LABELS,
  type ActivityItem,
} from "./metrics";

describe("percentChange", () => {
  it("computes a normal increase and decrease", () => {
    expect(percentChange(120, 100)).toBeCloseTo(20);
    expect(percentChange(80, 100)).toBeCloseTo(-20);
  });

  it("reports an exact zero change", () => {
    expect(percentChange(100, 100)).toBe(0);
  });

  /**
   * The rule that keeps the dashboard honest: there is no percentage change
   * from a zero baseline. Returning +100% (or Infinity) would be a fabricated
   * trend — CLAUDE.md §30.7.
   */
  it("returns undefined when the previous period was zero", () => {
    expect(percentChange(40, 0)).toBeUndefined();
    expect(percentChange(0, 0)).toBeUndefined();
  });

  it("never returns Infinity or NaN", () => {
    for (const [cur, prev] of [
      [1, 0],
      [0, 0],
      [Number.NaN, 10],
      [10, Number.NaN],
    ]) {
      const result = percentChange(cur, prev);
      expect(result === undefined || Number.isFinite(result)).toBe(true);
    }
  });

  it("handles a drop to zero, which is a real -100%", () => {
    expect(percentChange(0, 50)).toBe(-100);
  });
});

describe("isNewActivity", () => {
  it("is true only when activity appeared without a baseline", () => {
    expect(isNewActivity(40, 0)).toBe(true);
    expect(isNewActivity(0, 0)).toBe(false);
    expect(isNewActivity(40, 10)).toBe(false);
  });
});

describe("metric labelling", () => {
  it("calls clicks clicks, never conversions", () => {
    expect(METRIC_LABELS.click).toBe("Button clicks");
    for (const label of Object.values(METRIC_LABELS)) {
      expect(label.toLowerCase()).not.toContain("conversion");
    }
  });

  it("never claims a review was left or a payment was made", () => {
    const phrases = [
      blockClickPhrase("google_review"),
      blockClickPhrase("whatsapp"),
      blockClickPhrase("mpesa"),
      blockClickPhrase("custom"),
    ];
    for (const phrase of phrases) {
      expect(phrase.toLowerCase()).not.toMatch(/left|received|paid|submitted|completed/);
    }
    expect(blockClickPhrase("google_review")).toBe("Review link opened");
  });

  it("describes activity rows by what was observed", () => {
    const lead: ActivityItem = {
      kind: "lead",
      type: "lead",
      label: "Amina",
      page_title: "Java House",
      page_slug: "java-house",
      ts: new Date().toISOString(),
    };
    expect(activityPhrase(lead)).toBe("New lead");
    expect(activityPhrase({ ...lead, kind: "event", type: "download" })).toBe("Contact saved");
    expect(activityPhrase({ ...lead, kind: "event", type: "click" })).toBe("Action clicked");
  });
});

describe("range handling", () => {
  it("accepts only the supported windows", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("30")).toBe(30);
  });

  it("falls back to 30 days for junk input", () => {
    for (const bad of ["", "0", "-1", "365", "abc", undefined, "7; drop table"]) {
      expect(parseRange(bad)).toBe(30);
    }
  });

  it("names the baseline so a delta is never ambiguous", () => {
    expect(comparisonLabel(7)).toBe("vs previous 7 days");
    expect(comparisonLabel(90)).toBe("vs previous 90 days");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-08-15T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("formats recent moments", () => {
    expect(relativeTime(ago(10_000), now)).toBe("just now");
    expect(relativeTime(ago(4 * 60_000), now)).toBe("4 min ago");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("3 hours ago");
    expect(relativeTime(ago(1 * 3_600_000), now)).toBe("1 hour ago");
    expect(relativeTime(ago(2 * 86_400_000), now)).toBe("2 days ago");
  });

  it("falls back to a date beyond a week", () => {
    expect(relativeTime(ago(30 * 86_400_000), now)).toMatch(/\d/);
  });

  it("does not throw on an invalid timestamp", () => {
    expect(relativeTime("not-a-date", now)).toBe("");
  });
});
