import { useQuery } from "@tanstack/react-query";
import type { Analytics } from "@taptap/core/analytics";
import type { EventType } from "@taptap/core/metrics";
import { parseResponse } from "./parse";
import { array, nullable, number, object, record, string } from "./shape";
import { supabase } from "./supabase";

/**
 * Analytics (PLAN.md §8): the web's get_analytics (0011), called as the
 * signed-in person, with the same lib/analytics.ts arithmetic on top — so the
 * app and the website show the same numbers for the same range and profile.
 */
export type AnalyticsRange = 7 | 30 | 90;

const EVENT_TYPES: EventType[] = ["tap", "scan", "view", "click", "download", "lead"];

const AnalyticsRow = object({
  days: number,
  scope: string,
  pages: number,
  totals: record,
  previous: record,
  leads: number,
  previous_leads: number,
  daily: nullable(array(
    object({
      date: string,
      tap: number,
      scan: number,
      view: number,
      click: number,
      download: number,
      lead: number,
    }),
  )),
  by_source: nullable(array(object({ source: string, count: number }))),
  by_device: nullable(array(object({ id: string, label: nullable(string), token: string, count: number }))),
  by_country: nullable(array(object({ country: string, count: number }))),
  by_hour: nullable(array(object({ hour: number, count: number }))),
  top_blocks: nullable(array(object({ label: string, type: string, count: number }))),
  top_pages: nullable(array(object({ id: string, slug: string, title: nullable(string), events: number }))),
});

/** Event counts keyed by type, ignoring any type this app version does not know. */
function counts(raw: Record<string, unknown>): Partial<Record<EventType, number>> {
  const out: Partial<Record<EventType, number>> = {};
  for (const type of EVENT_TYPES) {
    const v = raw[type];
    if (typeof v === "number" && Number.isFinite(v)) out[type] = v;
  }
  return out;
}

export function toAnalytics(row: ReturnType<typeof AnalyticsRow>): Analytics {
  return {
    days: row.days,
    scope: row.scope === "page" ? "page" : "account",
    pages: row.pages,
    totals: counts(row.totals),
    previous: counts(row.previous),
    leads: row.leads,
    previous_leads: row.previous_leads,
    daily: row.daily ?? [],
    by_source: row.by_source ?? [],
    by_device: (row.by_device ?? []).map((d) => ({ ...d, label: d.label })),
    by_country: row.by_country ?? [],
    by_hour: row.by_hour ?? [],
    top_blocks: row.top_blocks ?? [],
    top_pages: row.top_pages ?? [],
  };
}

export const analyticsKey = (userId: string, days: AnalyticsRange, pageId: string | null) =>
  ["analytics", userId, days, pageId ?? "all"] as const;

export async function fetchAnalytics(days: AnalyticsRange, pageId: string | null): Promise<Analytics> {
  const { data, error } = await supabase.rpc("get_analytics", { p_days: days, p_page_id: pageId });
  if (error) throw error;
  return toAnalytics(parseResponse(AnalyticsRow, data, "get_analytics"));
}

export function useAnalytics(userId: string | null, days: AnalyticsRange, pageId: string | null = null) {
  return useQuery({
    queryKey: analyticsKey(userId ?? "", days, pageId),
    queryFn: () => fetchAnalytics(days, pageId),
    enabled: userId !== null,
    // Counts move slowly; five minutes, as PLAN.md §4.5 sets for analytics.
    staleTime: 5 * 60 * 1000,
  });
}
