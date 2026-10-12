import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  composeFirstTapPush,
  composeLeadPush,
  composeTermPush,
  pushCardName,
  sendPush,
  type PushMessage,
} from "./push";
import { renewalDedupeKey, type IdentityForEmail, type RenewalMilestone } from "./renewal-email";

/**
 * Push, beside each email the web already sends (PLAN.md §9 W9): a new lead,
 * a card's first tap, a card's term. Same rules as the emails: never throws,
 * runs after the response has gone (inside `after()`), and claims each send in
 * notification_deliveries BEFORE making it, on its own channel ('push'), so a
 * retry or a race never notifies twice. Which phones get it — and whether a
 * phone wants that kind — is push_targets (0034).
 */

export type PushOutcome =
  | { status: "sent"; phones: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

type Claim = { accountId: string; kind: string; refId: string; dedupeKey?: string };

/** Claims, sends to every phone that wants this kind, records what Expo said, forgets removed phones. */
async function claimAndPush(
  admin: SupabaseClient,
  claim: Claim,
  prefKind: "lead" | "first_tap" | "term",
  message: PushMessage,
): Promise<PushOutcome> {
  const { data: tokens, error: targetError } = await admin.rpc("push_targets", {
    p_account_id: claim.accountId,
    p_kind: prefKind,
  });
  if (targetError) return { status: "failed", error: targetError.message };
  const phones = (tokens ?? []) as string[];
  if (phones.length === 0) return { status: "skipped", reason: "no phone wants it" };

  const { error: claimError } = await admin.from("notification_deliveries").insert({
    account_id: claim.accountId,
    kind: claim.kind,
    ref_id: claim.refId,
    channel: "push",
    status: "failed",
    error: "in flight",
    ...(claim.dedupeKey ? { dedupe_key: claim.dedupeKey } : {}),
  });
  if (claimError) {
    if (claimError.code === "23505") return { status: "skipped", reason: "already notified" };
    return { status: "failed", error: claimError.message };
  }

  const result = await sendPush(phones, message);
  if (result.goneTokens.length > 0) {
    await admin.rpc("forget_push_tokens", { p_tokens: result.goneTokens });
  }

  const update = admin
    .from("notification_deliveries")
    .update(
      result.sent > 0
        ? { status: "sent", error: result.failed > 0 ? `${result.failed} of ${phones.length} failed` : null }
        : { status: "failed", error: result.errors[0] ?? "no phone accepted it" },
    );
  if (claim.dedupeKey) await update.eq("dedupe_key", claim.dedupeKey);
  else await update.eq("kind", claim.kind).eq("ref_id", claim.refId).eq("channel", "push");

  return result.sent > 0
    ? { status: "sent", phones: result.sent }
    : { status: "failed", error: result.errors[0] ?? "no phone accepted it" };
}

/** "New lead · Someone left their details on {profile}." — no name, no number. */
export async function pushNewLead(leadId: string, admin: SupabaseClient = createAdminClient()): Promise<PushOutcome> {
  try {
    const { data, error } = await admin.rpc("lead_notification_target", { p_lead_id: leadId });
    if (error) return { status: "failed", error: error.message };
    const target = data as { accountId: string; pageTitle: string | null } | null;
    if (!target) return { status: "skipped", reason: "lead not found" };
    return await claimAndPush(
      admin,
      { accountId: target.accountId, kind: "lead", refId: leadId },
      "lead",
      composeLeadPush({ leadId, profileTitle: target.pageTitle }),
    );
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "push failed" };
  }
}

/** "Your card is live" — after a dispatched card's first tap (D-032), which opens that card. */
export async function pushFirstTap(
  tagId: string,
  orderId: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<PushOutcome> {
  try {
    const { data: tag, error } = await admin
      .from("nfc_tags")
      .select("id, label, kind, account_id")
      .eq("id", tagId)
      .maybeSingle();
    if (error) return { status: "failed", error: error.message };
    if (!tag?.account_id) return { status: "skipped", reason: "card not on an account" };
    return await claimAndPush(
      admin,
      { accountId: tag.account_id, kind: "first_tap", refId: orderId },
      "first_tap",
      composeFirstTapPush({ cardId: tag.id, cardName: pushCardName(tag) }),
    );
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "push failed" };
  }
}

/**
 * A card's term milestone, one notification per card. Deduplicated by the same
 * term-aware key as the email, with ":push" added — the dedupe index is unique
 * across channels.
 */
export async function pushTerm(
  admin: SupabaseClient,
  accountId: string,
  identity: IdentityForEmail,
  milestone: RenewalMilestone,
): Promise<PushOutcome> {
  try {
    return await claimAndPush(
      admin,
      {
        accountId,
        kind: `renewal_${milestone}`,
        refId: identity.id,
        dedupeKey: `${renewalDedupeKey(identity.id, identity.termEnd, milestone)}:push`,
      },
      "term",
      composeTermPush({
        cardId: identity.id,
        cardName: pushCardName(identity),
        termEnd: identity.termEnd,
        milestone,
      }),
    );
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "push failed" };
  }
}
