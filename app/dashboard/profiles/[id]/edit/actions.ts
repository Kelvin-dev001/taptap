"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadBillingContext } from "@/lib/billing-context";
import { publishBlockedReason } from "@/lib/entitlement";
import { defaultLabel } from "@/lib/blocks";
import { parseDraftInput, type DraftInput } from "@/lib/draft";
import { saveDraft } from "@/lib/page-draft";

export type SavePayload = DraftInput;

export type SaveResult = {
  error?: string;
  success?: string;
  /** The draft's new version; the next save sends it as `expectedUpdatedAt`. */
  updatedAt?: string;
  /** Saved elsewhere since this editor loaded — the app, or another tab. */
  conflict?: { updatedAt: string };
};

const UNSAVEABLE = "Something in this draft could not be saved. Reload the page and try again.";

/**
 * Persists the draft. Saving does NOT make changes public — that is what
 * publishPageAction does (migration 0009). An owner can now edit a live page
 * without the edits going out mid-sentence, which UI-0 flagged as dangerous.
 *
 * The write is lib/page-draft.ts, shared with the app's autosave: actions keep
 * their ids across saves, so their click history survives (D-046).
 */
export async function savePageAction(
  pageId: string,
  payload: SavePayload,
): Promise<SaveResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // A server action is a public endpoint like any other, so its argument is
  // checked as untrusted input.
  const parsed = parseDraftInput(payload);
  if (!parsed.ok) return { error: UNSAVEABLE };

  const result = await saveDraft(supabase, pageId, parsed.input);
  if (result.ok) {
    revalidatePath(`/dashboard/profiles/${pageId}/edit`);
    return { success: "Saved.", updatedAt: result.updatedAt };
  }

  switch (result.code) {
    case "conflict":
      return { conflict: { updatedAt: result.updatedAt } };
    case "not_found":
      return { error: "Page not found." };
    case "invalid_redirect":
      return { error: "Enter a valid redirect URL (http, https, tel, or mailto)." };
    case "invalid_destination": {
      const block = parsed.input.blocks[result.index];
      return { error: `“${block.label || defaultLabel(block.type)}” has an invalid destination.` };
    }
    case "invalid_block":
      return { error: UNSAVEABLE };
    case "schema_pending":
      return {
        error:
          "Saving is paused while a database update (0030_page_draft_and_click_attribution.sql) is applied. Your changes are still on this screen.",
      };
    case "error":
      return { error: result.message };
  }
}

export type PublishResult = { error?: string; publishedAt?: string };

/**
 * Snapshots the current draft and makes it the public page.
 *
 * Checked in three independent places, and that is not redundancy for its own
 * sake (D-021):
 *
 *   the editor  decides what the button offers to do
 *   HERE        decides whether this request is allowed, against current state
 *   the database refuses regardless, so neither of the above can be bypassed
 *
 * The check here exists to produce a good error rather than a Postgres
 * exception. It is the RPC and the trigger that actually stop anyone: a client
 * can call this action directly, and could call PostgREST directly if the column
 * grants in 0019 did not exist.
 */
export async function publishPageAction(pageId: string): Promise<PublishResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No account found." };

  const billing = await loadBillingContext(supabase, profile.account_id);
  const entitlementRow = billing.pages.find((p) => p.id === pageId);
  // An unknown page is refused rather than passed through: the RPC would reject
  // it anyway, and "cannot tell" is never a reason to publish.
  if (!entitlementRow) return { error: "Page not found." };

  const blocked = publishBlockedReason(entitlementRow, billing.pages, billing.identities);
  if (blocked) return { error: `insufficient_entitlement: ${blocked}` };

  const { data, error } = await supabase.rpc("publish_page", { p_page_id: pageId });
  if (error) return { error: error.message };

  const { data: page } = await supabase
    .from("smart_pages")
    .select("slug")
    .eq("id", pageId)
    .single();
  if (page?.slug) revalidatePath(`/${page.slug}`);
  revalidatePath("/dashboard/profiles");

  const result = data as { published_at?: string } | null;
  return { publishedAt: result?.published_at ?? new Date().toISOString() };
}

/** Takes the page off the air. The snapshot is kept so republishing restores it. */
export async function unpublishPageAction(pageId: string): Promise<PublishResult> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("unpublish_page", { p_page_id: pageId });
  if (error) return { error: error.message };

  const { data: page } = await supabase
    .from("smart_pages")
    .select("slug")
    .eq("id", pageId)
    .single();
  if (page?.slug) revalidatePath(`/${page.slug}`);
  revalidatePath("/dashboard/profiles");
  return {};
}
