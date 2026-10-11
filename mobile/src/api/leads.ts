import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";
import { isLeadStatus, type Lead, type LeadCounts, type LeadStatus } from "@taptap/core/leads";
import { parseResponse } from "./parse";
import { array, nullable, number, object, record, string } from "./shape";
import { supabase } from "./supabase";

/**
 * Leads (PLAN.md §8): the web's own functions, called as the signed-in person.
 * get_leads is paged by a cursor (0031) — the created_at and id of the last
 * lead shown — so the list can be scrolled to the end however long it is, and
 * a lead arriving meanwhile never shifts what comes next.
 */

/** All time: an owner scrolls back as far as they like (the web shows windows). */
export const LEAD_DAYS = 3650;
export const LEAD_PAGE_SIZE = 30;

const LeadRow = object({
  id: string,
  smart_page_id: string,
  page_title: nullable(string),
  page_slug: string,
  name: nullable(string),
  phone: nullable(string),
  email: nullable(string),
  company: nullable(string),
  message: nullable(string),
  status: string,
  note: nullable(string),
  created_at: string,
  updated_at: nullable(string),
  repeat_count: number,
});

function toLead(row: ReturnType<typeof LeadRow>): Lead {
  return { ...row, status: isLeadStatus(row.status) ? row.status : "new" };
}

export type LeadFilter = { status: LeadStatus | null; pageId: string | null };
export type Cursor = { createdAt: string; id: string } | null;

export const leadsKey = (userId: string, filter: LeadFilter) =>
  ["leads", userId, filter.status ?? "all", filter.pageId ?? "all"] as const;
export const leadCountsKey = (userId: string, pageId: string | null) =>
  ["leadCounts", userId, pageId ?? "all"] as const;

export async function fetchLeadPage(filter: LeadFilter, cursor: Cursor): Promise<Lead[]> {
  const { data, error } = await supabase.rpc("get_leads", {
    p_days: LEAD_DAYS,
    p_page_id: filter.pageId,
    p_status: filter.status,
    p_limit: LEAD_PAGE_SIZE,
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
  });
  if (error) throw error;
  return parseResponse(array(LeadRow), data, "get_leads").map(toLead);
}

/** The next page starts after the last lead of this one; a short page is the end. */
export function nextCursor(lastPage: Lead[]): Cursor | undefined {
  if (lastPage.length < LEAD_PAGE_SIZE) return undefined;
  const last = lastPage[lastPage.length - 1];
  return { createdAt: last.created_at, id: last.id };
}

export function useLeads(userId: string | null, filter: LeadFilter) {
  return useInfiniteQuery({
    queryKey: leadsKey(userId ?? "", filter),
    queryFn: ({ pageParam }) => fetchLeadPage(filter, pageParam),
    initialPageParam: null as Cursor,
    getNextPageParam: nextCursor,
    enabled: userId !== null,
    staleTime: 30_000,
  });
}

/**
 * Pull-to-refresh: back to the first page, then fetch it. TanStack would
 * otherwise refetch every page already scrolled through, one request each.
 */
export function firstPageOnly(data: InfiniteData<Lead[], Cursor> | undefined) {
  if (!data) return data;
  return { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) };
}

const CountsRow = object({ all: number, by_status: record });

export async function fetchLeadCounts(pageId: string | null): Promise<LeadCounts> {
  const { data, error } = await supabase.rpc("get_lead_counts", { p_days: LEAD_DAYS, p_page_id: pageId });
  if (error) throw error;
  const row = parseResponse(CountsRow, data, "get_lead_counts");
  const byStatus: LeadCounts["by_status"] = {};
  for (const [status, count] of Object.entries(row.by_status)) {
    if (isLeadStatus(status) && typeof count === "number") byStatus[status] = count;
  }
  return { all: row.all, by_status: byStatus };
}

export function useLeadCounts(userId: string | null, pageId: string | null = null) {
  return useQuery({
    queryKey: leadCountsKey(userId ?? "", pageId),
    queryFn: () => fetchLeadCounts(pageId),
    enabled: userId !== null,
    staleTime: 30_000,
  });
}

/** Every lead loaded in any list, newest first, without duplicates. */
export function loadedLeads(caches: (InfiniteData<Lead[]> | undefined)[]): Lead[] {
  const byId = new Map<string, Lead>();
  for (const cache of caches) for (const page of cache?.pages ?? []) for (const l of page) byId.set(l.id, l);
  return [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

const SingleLead = object({
  id: string,
  smart_page_id: string,
  name: nullable(string),
  phone: nullable(string),
  email: nullable(string),
  company: nullable(string),
  message: nullable(string),
  status: string,
  note: nullable(string),
  created_at: string,
  updated_at: nullable(string),
  smart_pages: nullable(object({ title: nullable(string), slug: string })),
});

/**
 * One lead by id, for when it is not in any loaded list (a notification, M5).
 * The table read is RLS-scoped (0003). Earlier enquiries are not counted here.
 */
export async function fetchLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, smart_page_id, name, phone, email, company, message, status, note, created_at, updated_at, smart_pages(title, slug)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = parseResponse(SingleLead, data, "leads.one");
  return {
    id: row.id,
    smart_page_id: row.smart_page_id,
    page_title: row.smart_pages?.title ?? null,
    page_slug: row.smart_pages?.slug ?? "",
    name: row.name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    message: row.message,
    status: isLeadStatus(row.status) ? row.status : "new",
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    repeat_count: 0,
  };
}

export type LeadPatch = { status?: LeadStatus; note?: string | null };

/**
 * Status and note — the only columns an owner may change (0012). Everything
 * else is what the customer submitted, and stays as they sent it.
 */
export async function updateLead(id: string, patch: LeadPatch): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}
