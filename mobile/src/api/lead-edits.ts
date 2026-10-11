import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { Lead, LeadCounts, LeadStatus } from "@taptap/core/leads";
import { updateLead, type LeadPatch } from "./leads";

/**
 * Lead status and note, changed at once and kept until the server has them
 * (PLAN.md §4.5: "status and note queued").
 *
 * TanStack Query does the queueing: a change made offline pauses, is written to
 * the phone with the rest of the cache, and resumes when the phone is back
 * online — even after the app was closed, because the function that sends it
 * is registered here by key rather than held by a screen. Changes to one lead
 * run in order (scope), so "Contacted" then "Won" never arrives as "Contacted".
 *
 * Last write wins: status and note are the owner's own annotations (0012), and
 * two devices disagreeing about one is not worth a conflict prompt.
 */
export const UPDATE_LEAD = ["lead", "update"] as const;

/** One lead, for its own screen. */
export const leadKey = (id: string) => ["lead", id] as const;

export type LeadEdit = { id: string; patch: LeadPatch };

/** A lead with the change applied, as every cached list should show it. */
export function patchLeadPages(
  data: InfiniteData<Lead[]> | undefined,
  id: string,
  patch: LeadPatch,
): InfiniteData<Lead[]> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => page.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead))),
  };
}

/** Counts after one lead moved from one status to another. */
export function moveCount(
  counts: LeadCounts | undefined,
  from: LeadStatus,
  to: LeadStatus,
): LeadCounts | undefined {
  if (!counts || from === to) return counts;
  const by = { ...counts.by_status };
  by[from] = Math.max(0, (by[from] ?? 0) - 1);
  by[to] = (by[to] ?? 0) + 1;
  return { ...counts, by_status: by };
}

/** Counts after one lead was deleted. */
export function removeCount(counts: LeadCounts | undefined, status: LeadStatus): LeadCounts | undefined {
  if (!counts) return counts;
  return {
    all: Math.max(0, counts.all - 1),
    by_status: { ...counts.by_status, [status]: Math.max(0, (counts.by_status[status] ?? 0) - 1) },
  };
}

/** The lead as currently cached, wherever it is. */
export function findCachedLead(client: QueryClient, id: string): Lead | undefined {
  const single = client.getQueryData<Lead | null>(leadKey(id));
  if (single) return single;
  for (const [, data] of client.getQueriesData<InfiniteData<Lead[]>>({ queryKey: ["leads"] })) {
    for (const page of data?.pages ?? []) {
      const lead = page.find((l) => l.id === id);
      if (lead) return lead;
    }
  }
  return undefined;
}

/** Shows a change everywhere at once: every list, and the counts. */
export function applyLeadEdit(client: QueryClient, { id, patch }: LeadEdit) {
  const before = findCachedLead(client, id);
  client.setQueriesData<InfiniteData<Lead[]>>({ queryKey: ["leads"] }, (data) => patchLeadPages(data, id, patch));
  client.setQueryData<Lead | null>(leadKey(id), (lead) => (lead ? { ...lead, ...patch } : lead));
  if (before && patch.status && patch.status !== before.status) {
    const from = before.status;
    const to = patch.status;
    client.setQueriesData<LeadCounts>({ queryKey: ["leadCounts"] }, (counts) => moveCount(counts, from, to));
  }
}

/** Fetches what the server really has for a lead, after a change it refused. */
export function resyncLead(client: QueryClient, id: string) {
  void client.invalidateQueries({ queryKey: ["leads"] });
  void client.invalidateQueries({ queryKey: ["leadCounts"] });
  void client.invalidateQueries({ queryKey: leadKey(id) });
}

/**
 * Registers how a lead edit is sent, so a change paused offline can be resumed
 * by a later launch that never saw the screen that made it.
 */
export function registerLeadEdits(client: QueryClient) {
  client.setMutationDefaults(UPDATE_LEAD, {
    mutationFn: ({ id, patch }: LeadEdit) => updateLead(id, patch),
    retry: 3,
    onMutate: (edit: LeadEdit) => applyLeadEdit(client, edit),
    // Refused for good (say, the lead was deleted elsewhere): show what the
    // server really has.
    onError: (_error: unknown, { id }: LeadEdit) => resyncLead(client, id),
  });
}

/** After a delete: gone from every list, the counts, and its own cache entry. */
export function removeLeadFromCaches(client: QueryClient, lead: Lead) {
  client.setQueriesData<InfiniteData<Lead[]>>({ queryKey: ["leads"] }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => page.filter((l) => l.id !== lead.id)) } : data,
  );
  client.setQueriesData<LeadCounts>({ queryKey: ["leadCounts"] }, (counts) => removeCount(counts, lead.status));
  client.removeQueries({ queryKey: leadKey(lead.id) });
}
