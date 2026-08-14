/**
 * Dashboard metric semantics.
 *
 * This module is where "do not fabricate analytics" (CLAUDE.md §15, §30.7)
 * stops being a principle and becomes code. Two rules matter most:
 *
 *  1. A percentage change from a zero baseline does not exist. Reporting "+100%"
 *     when a metric went 0 -> 40 is a fabrication: the true value is undefined.
 *     `percentChange` returns undefined and the UI says "new" instead.
 *  2. Event labels describe what was OBSERVED, never what was achieved. The
 *     platform sees a Google review link being clicked; it cannot see a review
 *     being left.
 */

export type EventType = "tap" | "scan" | "view" | "click" | "download" | "lead";

export type DashboardOverview = {
  days: number;
  pages: number;
  totals: Partial<Record<EventType, number>>;
  previous: Partial<Record<EventType, number>>;
  leads: number;
  previous_leads: number;
  daily: { date: string; tap: number; scan: number; view: number; click: number }[];
  top_pages: { id: string; slug: string; title: string | null; events: number }[];
  top_blocks: { label: string; type: string; count: number }[];
};

export type ActivityItem = {
  kind: "lead" | "event";
  type: string;
  label: string;
  page_title: string | null;
  page_slug: string;
  ts: string;
};

/**
 * Percentage change between two periods.
 *
 * Returns `undefined` when the previous period is zero — there is no percentage
 * change from nothing, and rendering one would invent a trend. Callers should
 * show a "new" badge or nothing at all.
 */
export function percentChange(current: number, previous: number): number | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return undefined;
  if (previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

/** True when a metric appeared this period with no prior baseline. */
export function isNewActivity(current: number, previous: number): boolean {
  return previous === 0 && current > 0;
}

/**
 * Display names for the six event types.
 *
 * "Button clicks" — not "conversions". "Contacts saved" is the one genuinely
 * completed action we can observe, because the vCard download fires from our
 * own code rather than a departing link.
 */
export const METRIC_LABELS: Record<EventType, string> = {
  tap: "Taps",
  scan: "QR scans",
  view: "Profile views",
  click: "Button clicks",
  download: "Contacts saved",
  lead: "Leads",
};

/** One-line explanation of exactly what each metric counts. */
export const METRIC_HINTS: Record<EventType, string> = {
  tap: "An NFC card or link opened a profile",
  scan: "A QR code opened a profile",
  view: "A smart page was displayed",
  click: "An action button was clicked — not necessarily completed",
  download: "A contact card was saved to a phone",
  lead: "A lead form was submitted",
};

/**
 * Phrasing for the activity feed.
 *
 * Every click phrase ends in "opened" or "clicked". None claims completion: we
 * know the link was followed and nothing after that.
 */
export function activityPhrase(item: ActivityItem): string {
  if (item.kind === "lead") return "New lead";
  if (item.type === "download") return "Contact saved";

  switch (item.type) {
    case "click":
      return "Action clicked";
    default:
      return "Activity";
  }
}

/** Human phrase for a clicked block type, honest about what is observable. */
export function blockClickPhrase(blockType: string): string {
  switch (blockType) {
    case "google_review":
      return "Review link opened";
    case "whatsapp":
      return "WhatsApp opened";
    case "call":
      return "Call started";
    case "email":
      return "Email opened";
    case "directions":
      return "Directions opened";
    case "contact":
      return "Contact saved";
    default:
      return "Link opened";
  }
}

/** Compact relative time for feed rows ("4 min ago"). */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.round((now.getTime() - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString();
}

/** Valid dashboard windows. Anything else falls back to 30 days. */
export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function parseRange(value: string | undefined): RangeDays {
  const n = Number(value);
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

export function rangeLabel(days: RangeDays): string {
  return days === 7 ? "Last 7 days" : days === 90 ? "Last 90 days" : "Last 30 days";
}

/** "vs previous 30 days" — names the baseline so a delta is never ambiguous. */
export function comparisonLabel(days: RangeDays): string {
  return `vs previous ${days} days`;
}
