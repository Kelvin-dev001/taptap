import { describe, it, expect } from "vitest";
import {
  reachCount,
  engagementCount,
  confirmedCount,
  pageOpens,
  confirmedRate,
  engagementRate,
  sourceLabel,
  countryLabel,
  hourLabel,
  busiestWindow,
  REACH_EVENTS,
  ENGAGEMENT_EVENTS,
  CONFIRMED_EVENTS,
} from "./analytics";

const totals = {
  tap: 100,
  scan: 40,
  view: 160,
  click: 60,
  download: 12,
  lead: 8,
};

describe("event classification", () => {
  /**
   * CLAUDE.md §15 makes click-vs-conversion mandatory. The rule that enforces
   * it: only outcomes that complete inside our own code count as confirmed.
   * A click leaves for another app and never reports back.
   */
  it("counts only downloads and leads as confirmed", () => {
    expect(CONFIRMED_EVENTS).toEqual(["download", "lead"]);
    expect(confirmedCount(totals)).toBe(20);
  });

  it("never treats a click as a conversion", () => {
    expect(CONFIRMED_EVENTS).not.toContain("click");
    expect(ENGAGEMENT_EVENTS).toEqual(["click"]);
    expect(engagementCount(totals)).toBe(60);
  });

  it("counts arrivals as reach", () => {
    expect(REACH_EVENTS).toEqual(["tap", "scan", "view"]);
    expect(reachCount(totals)).toBe(300);
  });

  it("copes with missing buckets", () => {
    expect(reachCount({})).toBe(0);
    expect(confirmedCount({ lead: 3 })).toBe(3);
  });
});

describe("pageOpens", () => {
  /**
   * An NFC tap on a smart page records BOTH a tap (at /t/<token>) and a view
   * (when the page renders), so including taps would count one visit twice.
   * Redirect links record a tap with no page to act on at all.
   */
  it("excludes taps, which would double-count an NFC visit", () => {
    expect(pageOpens(totals)).toBe(200); // view 160 + scan 40
    expect(pageOpens({ tap: 500 })).toBe(0);
  });
});

describe("rates", () => {
  it("computes confirmed and engagement rates over page opens", () => {
    expect(confirmedRate(totals)).toBeCloseTo(10); // 20 / 200
    expect(engagementRate(totals)).toBeCloseTo(30); // 60 / 200
  });

  /**
   * A rate out of zero is unknown, not 0% — the same rule as percentChange.
   */
  it("returns undefined when there is nothing to divide by", () => {
    expect(confirmedRate({})).toBeUndefined();
    expect(confirmedRate({ tap: 90 })).toBeUndefined();
    expect(engagementRate({ click: 5 })).toBeUndefined();
  });

  it("never returns Infinity or NaN", () => {
    for (const t of [{}, { tap: 1 }, { view: 0, scan: 0, download: 5 }]) {
      const r = confirmedRate(t);
      expect(r === undefined || Number.isFinite(r)).toBe(true);
    }
  });
});

describe("labels", () => {
  it("reports unrecorded sources as unattributed rather than folding them into Direct", () => {
    expect(sourceLabel("unknown")).toBe("Not recorded");
    expect(sourceLabel("direct")).toBe("Direct link");
    expect(sourceLabel("nfc")).toBe("NFC card");
    expect(sourceLabel("qr")).toBe("QR code");
  });

  it("resolves country codes without a dependency", () => {
    expect(countryLabel("KE")).toBe("Kenya");
    expect(countryLabel("ke")).toBe("Kenya");
    expect(countryLabel("unknown")).toBe("Unknown");
    expect(countryLabel("")).toBe("Unknown");
  });

  it("formats hours in 12-hour time", () => {
    expect(hourLabel(0)).toBe("12 AM");
    expect(hourLabel(9)).toBe("9 AM");
    expect(hourLabel(12)).toBe("12 PM");
    expect(hourLabel(14)).toBe("2 PM");
    expect(hourLabel(23)).toBe("11 PM");
  });
});

describe("busiestWindow", () => {
  it("finds the busiest three-hour stretch and its share", () => {
    const result = busiestWindow([
      { hour: 9, count: 1 },
      { hour: 14, count: 10 },
      { hour: 15, count: 12 },
      { hour: 16, count: 8 },
      { hour: 20, count: 2 },
    ])!;
    expect(result.startHour).toBe(14);
    expect(result.endHour).toBe(17);
    expect(result.count).toBe(30);
    expect(result.share).toBeCloseTo((30 / 33) * 100);
  });

  it("returns nothing when there is no activity", () => {
    expect(busiestWindow([])).toBeUndefined();
    expect(busiestWindow([{ hour: 3, count: 0 }])).toBeUndefined();
  });

  it("ignores out-of-range hours rather than throwing", () => {
    expect(busiestWindow([{ hour: 30, count: 5 }])).toBeUndefined();
    expect(busiestWindow([{ hour: -1, count: 5 }])).toBeUndefined();
  });

  /** It reports a fact, not advice — recommendations belong to UI-10. */
  it("never returns a window outside the day", () => {
    const result = busiestWindow([{ hour: 23, count: 99 }])!;
    expect(result.endHour).toBeLessThanOrEqual(24);
  });
});
