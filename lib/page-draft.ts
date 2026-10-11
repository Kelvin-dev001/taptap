import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBillingContext } from "./billing-context";
import { draftProblem, withLeadFormRule, type DraftInput } from "./draft";
import { isMissingSchemaError } from "./schema-guard";

/**
 * Saves a profile draft — the one write behind the web editor's Save and the
 * app's autosave (docs/mobile/PLAN.md §9 W4, D-046).
 *
 * Runs with the caller's own client (a cookie session on the web, a Bearer
 * token from the app), so RLS decides whose page it is. The steps:
 *
 *   1. read the page (RLS: not yours → not found) for its account and type
 *   2. check the destinations (lib/draft.ts — the app runs the same rules)
 *   3. apply the lead-form rule from the account's live cards (D-018)
 *   4. write everything in one transaction with save_page_draft() (0030):
 *      actions keep their ids, and a stale `expectedUpdatedAt` is refused
 *
 * Saving never makes anything public; publish_page does that.
 */

export type SaveDraftResult =
  | { ok: true; updatedAt: string }
  /** Someone saved this profile since `expectedUpdatedAt`; theirs is `updatedAt`. */
  | { ok: false; code: "conflict"; updatedAt: string }
  | { ok: false; code: "not_found" }
  /** `index` is the action whose value would make a dead button. */
  | { ok: false; code: "invalid_destination"; index: number }
  | { ok: false; code: "invalid_redirect" }
  /** An action id belongs to a different profile. Only a broken client sends one. */
  | { ok: false; code: "invalid_block" }
  /** Migration 0030 has not been applied yet. */
  | { ok: false; code: "schema_pending" }
  | { ok: false; code: "error"; message: string };

type RpcResult = { ok?: boolean; code?: string; updated_at?: string };

export async function saveDraft(
  supabase: SupabaseClient,
  pageId: string,
  input: DraftInput,
): Promise<SaveDraftResult> {
  const { data: page, error: readError } = await supabase
    .from("smart_pages")
    .select("id, account_id, mode")
    .eq("id", pageId)
    .maybeSingle();
  if (readError) return { ok: false, code: "error", message: readError.message };
  if (!page) return { ok: false, code: "not_found" };

  const mode: "page" | "redirect" = input.mode ?? (page.mode === "page" ? "page" : "redirect");
  const problem = draftProblem(input, mode);
  if (problem) return { ok: false, ...problem };

  const { entitlements } = await loadBillingContext(supabase, page.account_id);
  const config = withLeadFormRule(input.config, entitlements.leadCapture);

  const { data, error } = await supabase.rpc("save_page_draft", {
    p_page_id: pageId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_title: input.title.trim() || null,
    p_mode: mode,
    p_redirect_url: mode === "redirect" ? (input.redirectUrl ?? "").trim() : null,
    p_config: config,
    p_theme: input.theme,
    p_blocks:
      mode === "page"
        ? input.blocks.map((b) => ({
            id: b.id,
            type: b.type,
            label: b.label.trim(),
            value: b.value.trim(),
            is_active: b.isActive,
          }))
        : null,
  });

  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, code: "schema_pending" };
    if (/invalid_block_id|duplicate_block_id/.test(error.message)) {
      return { ok: false, code: "invalid_block" };
    }
    return { ok: false, code: "error", message: error.message };
  }

  const result = (data ?? {}) as RpcResult;
  if (result.ok && typeof result.updated_at === "string") {
    return { ok: true, updatedAt: result.updated_at };
  }
  if (result.code === "conflict" && typeof result.updated_at === "string") {
    return { ok: false, code: "conflict", updatedAt: result.updated_at };
  }
  if (result.code === "not_found") return { ok: false, code: "not_found" };
  return { ok: false, code: "error", message: "Unexpected answer from save_page_draft." };
}
