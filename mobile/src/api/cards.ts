import { useQuery } from "@tanstack/react-query";
import type { IdentityRow } from "@taptap/core/identity";
import { parseResponse } from "./parse";
import { array, nullable, object, string } from "./shape";
import { supabase } from "./supabase";

/**
 * The account's cards and stands (PLAN.md §8, `cards`). M2 needs them only for
 * what they decide — whether a profile is live, may be published, and may show
 * a lead form (lib/entitlement.ts, lib/pricing.ts). M4 builds the Cards tab on
 * the same query.
 */
const CardRow = object({
  id: string,
  token: nullable(string),
  kind: nullable(string),
  label: nullable(string),
  status: nullable(string),
  account_id: nullable(string),
  smart_page_id: nullable(string),
  term_start: nullable(string),
  term_end: nullable(string),
  claimed_at: nullable(string),
});

export const cardsQueryKey = (userId: string) => ["cards", userId] as const;

export async function fetchCards(): Promise<IdentityRow[]> {
  const { data, error } = await supabase
    .from("nfc_tags")
    .select("id, token, kind, label, status, account_id, smart_page_id, term_start, term_end, claimed_at");
  if (error) throw error;
  return parseResponse(array(CardRow), data, "nfc_tags.list");
}

export function useCards(userId: string | null) {
  return useQuery({
    queryKey: cardsQueryKey(userId ?? ""),
    queryFn: fetchCards,
    enabled: userId !== null,
    staleTime: 60_000,
  });
}
