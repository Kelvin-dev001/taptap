"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSafeDestination } from "@/lib/url";
import { buildHref } from "@/lib/blocks";
import { loadBillingContext } from "@/lib/billing-context";
import { publishBlockedReason } from "@/lib/entitlement";
import type { Block, PageConfig, Theme } from "@/lib/profile";

export type SavePayload = {
  title: string;
  mode: "page" | "redirect";
  redirectUrl: string;
  config: PageConfig;
  theme: Theme;
  blocks: Block[];
};

export type SaveResult = { error?: string; success?: string };

/**
 * Persists the draft. Saving does NOT make changes public — that is what
 * publishPageAction does (migration 0009). An owner can now edit a live page
 * without the edits going out mid-sentence, which UI-0 flagged as dangerous.
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

  const { data: existing } = await supabase
    .from("smart_pages")
    .select("id, slug, account_id")
    .eq("id", pageId)
    .single();
  if (!existing) return { error: "Page not found." };

  if (payload.mode === "redirect" && !isSafeDestination(payload.redirectUrl)) {
    return { error: "Enter a valid redirect URL (http, https, tel, or mailto)." };
  }

  // Entitlement gating for lead capture stays server-side; a client cannot
  // grant itself a paid feature by posting config. Lead capture now follows the
  // account's active identities rather than a plan code (D-018).
  const { entitlements } = await loadBillingContext(supabase, existing.account_id);
  const config: PageConfig = {
    ...payload.config,
    leadForm: entitlements.leadCapture
      ? payload.config.leadForm
      : { ...payload.config.leadForm, enabled: false },
  };

  const { error: pageError } = await supabase
    .from("smart_pages")
    .update({
      title: payload.title || null,
      mode: payload.mode,
      redirect_url: payload.mode === "redirect" ? payload.redirectUrl : null,
      config,
      theme: payload.theme,
    })
    .eq("id", pageId);
  if (pageError) return { error: pageError.message };

  if (payload.mode === "page") {
    // Validate destinations before writing: a block with an unusable value is a
    // dead button on a customer's phone.
    for (const block of payload.blocks) {
      const def = buildHref(block.type, block.value);
      if (block.type !== "contact" && block.type !== "mpesa" && block.value && !def) {
        return { error: `“${block.label || block.type}” has an invalid destination.` };
      }
    }

    // Replace the set: simpler and safer than diffing, and the table is small.
    // Analytics keep working because events.link_id is ON DELETE SET NULL.
    const { error: delError } = await supabase
      .from("links")
      .delete()
      .eq("smart_page_id", pageId);
    if (delError) return { error: delError.message };

    if (payload.blocks.length > 0) {
      const { error: insError } = await supabase.from("links").insert(
        payload.blocks.map((b, i) => ({
          smart_page_id: pageId,
          type: b.type,
          label: b.label || null,
          value: b.value || null,
          sort_order: i,
          is_active: b.is_active !== false,
        })),
      );
      if (insError) return { error: insError.message };
    }
  }

  revalidatePath(`/dashboard/profiles/${pageId}/edit`);
  return { success: "Saved." };
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
