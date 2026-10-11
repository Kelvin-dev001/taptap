import i18n from "@/i18n";
import { formatAgo, formatDate, formatDateTime, formatDay, formatNumber, formatPercent } from "./format";

const t = i18n.t.bind(i18n);

describe("formatNumber", () => {
  it("groups thousands the Kenyan way", () => {
    expect(formatNumber(1284)).toBe("1,284");
    expect(formatNumber(1500000)).toBe("1,500,000");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("dates", () => {
  it("writes day, short month and year", () => {
    expect(formatDate("2026-12-31T09:00:00Z")).toMatch(/^31 Dec 2026$/);
    expect(formatDay("2026-10-05")).toMatch(/^5 Oct$/);
    expect(formatDateTime("2026-10-05T09:07:00")).toMatch(/^5 Oct, 09:07$/);
  });

  it("returns nothing for a value that is not a date", () => {
    expect(formatDate("soon")).toBe("");
    expect(formatDateTime("")).toBe("");
  });
});

describe("formatAgo", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("says how fresh something is, then falls back to the date", () => {
    expect(formatAgo(t, ago(20_000), now)).toBe("Just now");
    expect(formatAgo(t, ago(60_000), now)).toBe("1 min ago");
    expect(formatAgo(t, ago(5 * 60_000), now)).toBe("5 min ago");
    expect(formatAgo(t, ago(60 * 60_000), now)).toBe("1 hour ago");
    expect(formatAgo(t, ago(3 * 60 * 60_000), now)).toBe("3 hours ago");
    expect(formatAgo(t, ago(24 * 60 * 60_000), now)).toBe("1 day ago");
    expect(formatAgo(t, ago(10 * 24 * 60 * 60_000), now)).toMatch(/^1 Oct 2026$/);
  });

  it("treats a clock slightly ahead as just now", () => {
    expect(formatAgo(t, new Date(now.getTime() + 5_000).toISOString(), now)).toBe("Just now");
  });
});

describe("formatPercent", () => {
  it("rounds and drops the sign; the arrow carries direction", () => {
    expect(formatPercent(18.24)).toBe("18%");
    expect(formatPercent(-7.6)).toBe("8%");
  });
});
