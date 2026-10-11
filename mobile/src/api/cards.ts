import { useQuery } from "@tanstack/react-query";
import type { IdentityRow } from "@taptap/core/identity";
import { parseResponse } from "./parse";
import { array, boolean, nullable, number, object, string } from "./shape";
import { supabase } from "./supabase";

/**
 * The account's cards and stands (PLAN.md §8, `cards`). They decide whether a
 * profile is live, may be published and may show a lead form
 * (lib/entitlement.ts, lib/pricing.ts), and the Cards tab lists them.
 *
 * The table read is RLS-scoped (0005): another account's cards are invisible.
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
  serial: nullable(string),
  variant: nullable(string),
  is_placeholder: nullable(boolean),
});

/** A card as the app holds it: the identity fields lib/identity.ts reads, plus what the Cards tab shows. */
export type Card = IdentityRow & {
  id: string;
  token: string | null;
  serial: string | null;
  variant: string | null;
  /** Paid for, with no physical card assigned yet (0022). Nothing to tap. */
  isPlaceholder: boolean;
};

export const cardsQueryKey = (userId: string) => ["cards", userId] as const;

const COLUMNS =
  "id, token, kind, label, status, account_id, smart_page_id, term_start, term_end, claimed_at, serial, variant, is_placeholder";

export async function fetchCards(): Promise<Card[]> {
  const { data, error } = await supabase.from("nfc_tags").select(COLUMNS).order("claimed_at", { ascending: true });
  if (error) throw error;
  return parseResponse(array(CardRow), data, "nfc_tags.list").map((row) => ({
    ...row,
    isPlaceholder: row.is_placeholder === true,
  }));
}

export function useCards(userId: string | null) {
  return useQuery({
    queryKey: cardsQueryKey(userId ?? ""),
    queryFn: fetchCards,
    enabled: userId !== null,
    staleTime: 60_000,
  });
}

/** Taps per card over the last 30 days, from the web's get_devices_overview (0010). */
const ActivityRow = object({ id: string, taps: number, last_tap: nullable(string) });
export type CardActivity = { taps: number; lastTap: string | null };

export const cardActivityKey = (userId: string) => ["cardActivity", userId] as const;

export async function fetchCardActivity(): Promise<Record<string, CardActivity>> {
  const { data, error } = await supabase.rpc("get_devices_overview", { p_days: 30 });
  if (error) throw error;
  const rows = parseResponse(array(ActivityRow), data, "get_devices_overview");
  return Object.fromEntries(rows.map((r) => [r.id, { taps: r.taps, lastTap: r.last_tap }]));
}

export function useCardActivity(userId: string | null) {
  return useQuery({
    queryKey: cardActivityKey(userId ?? ""),
    queryFn: fetchCardActivity,
    enabled: userId !== null,
    staleTime: 60_000,
  });
}

/** Points a card you own at one of your published profiles (rebind_tag, 0020). */
export async function linkCard(cardId: string, pageId: string): Promise<void> {
  const { error } = await supabase.rpc("rebind_tag", { p_tag_id: cardId, p_page_id: pageId });
  if (error) throw error;
}

/** Switches a card off (taps open nothing) or back on (set_tag_status, 0020). */
export async function setCardOn(cardId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_tag_status", {
    p_tag_id: cardId,
    p_status: on ? "assigned" : "disabled",
  });
  if (error) throw error;
}

/** The card's name — the only column an owner may write directly (0020). */
export async function renameCard(cardId: string, label: string): Promise<void> {
  const trimmed = label.trim();
  const { error } = await supabase
    .from("nfc_tags")
    .update({ label: trimmed ? trimmed.slice(0, 60) : null })
    .eq("id", cardId);
  if (error) throw error;
}

/**
 * Who a card you just read belongs to, when it is not one of yours
 * (resolve_tag, 0022). Reading it records no tap: events are written only by
 * the /t route a customer's browser opens.
 */
export type ForeignCard = "unactivated" | "someone_else" | "unknown";

export async function identifyForeignCard(token: string): Promise<ForeignCard> {
  const { data, error } = await supabase.rpc("resolve_tag", { p_token: token });
  if (error) throw error;
  if (!data || typeof data !== "object") return "unknown";
  const status = (data as { status?: unknown }).status;
  return status === "unactivated" ? "unactivated" : "someone_else";
}

export type CardChangeError = "not_published" | "not_found" | "other";

/** The machine codes rebind_tag raises (0020), as outcomes a screen can explain. */
export function cardChangeErrorOf(message: string): CardChangeError {
  if (/page_not_published/.test(message)) return "not_published";
  if (/not found/.test(message)) return "not_found";
  return "other";
}
