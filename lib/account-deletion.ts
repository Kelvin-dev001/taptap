import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "./schema-guard";

/**
 * Deleting an account (docs/mobile/PLAN.md §9 W7; decided with Kelvin, 11 Oct
 * 2026, plan question 10). The rules live in `delete_account()` (0033): what
 * is deleted, what is kept for the tax record, and that a shared account only
 * loses this person. This file adds what the database cannot do itself:
 * empty the account's photos in Storage, and delete the Supabase Auth user.
 *
 * Runs with the SERVICE ROLE client, which bypasses RLS — so the caller must
 * have proved who the user is (a Bearer token checked by Supabase Auth) and
 * that they signed in moments ago (`signedInRecently`). It never takes a user
 * id from a request body.
 */

/** A deletion must follow a sign-in this recent (PLAN.md §4.11). */
export const FRESH_SIGN_IN_SECONDS = 10 * 60;

/**
 * Whether the access token comes from a sign-in in the last ten minutes. A
 * Supabase token carries `amr`: each way the person authenticated, with when.
 * `iat` is no use here — it moves every time the token is refreshed, which
 * happens without anyone signing in.
 *
 * Only call this on a token Supabase Auth has already accepted: it reads the
 * claims, it does not check the signature.
 */
export function signedInRecently(token: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const payload = token.split(".")[1];
  if (!payload) return false;
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return false;
  }
  const amr = (claims as { amr?: unknown }).amr;
  if (!Array.isArray(amr)) return false;
  const latest = Math.max(
    0,
    ...amr.map((m) => (m && typeof m.timestamp === "number" ? m.timestamp : 0)),
  );
  return latest > 0 && nowSeconds - latest <= FRESH_SIGN_IN_SECONDS && latest <= nowSeconds + 60;
}

export type DeleteAccountResult =
  /** The whole account was emptied, or only this person removed from a shared one. */
  | { ok: true; scope: "account" | "member"; photosRemoved: number }
  | { ok: false; code: "staff" | "not_found" | "schema_pending" | "error"; message?: string };

const BUCKET = "page-assets";

/** Every file under the account's folder (0002: `<account_id>/<page_id>/<file>`). */
async function listAccountFiles(admin: SupabaseClient, accountId: string): Promise<string[]> {
  const bucket = admin.storage.from(BUCKET);
  const files: string[] = [];
  const folders = [accountId];
  while (folders.length > 0) {
    const folder = folders.shift()!;
    const { data, error } = await bucket.list(folder, { limit: 1000 });
    if (error || !data) continue;
    for (const entry of data) {
      // A folder has no id; a file does.
      if (entry.id) files.push(`${folder}/${entry.name}`);
      else folders.push(`${folder}/${entry.name}`);
    }
  }
  return files;
}

export async function deleteAccount(admin: SupabaseClient, userId: string): Promise<DeleteAccountResult> {
  const { data, error } = await admin.rpc("delete_account", { p_user_id: userId });
  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, code: "schema_pending" };
    if (/staff_account/.test(error.message)) return { ok: false, code: "staff" };
    if (/no_account/.test(error.message)) return { ok: false, code: "not_found" };
    return { ok: false, code: "error", message: error.message };
  }
  const result = (data ?? {}) as { scope?: string; account_id?: string };
  const scope = result.scope === "member" ? "member" : "account";

  // Photos are best-effort: the database is already emptied, and a stray image
  // in a folder nobody can write to again is not worth failing the deletion.
  let photosRemoved = 0;
  if (scope === "account" && result.account_id) {
    try {
      const files = await listAccountFiles(admin, result.account_id);
      for (let i = 0; i < files.length; i += 100) {
        const batch = files.slice(i, i + 100);
        const { error: removeError } = await admin.storage.from(BUCKET).remove(batch);
        if (!removeError) photosRemoved += batch.length;
      }
    } catch {
      // Logged by the caller's error tracking if it matters; never blocks.
    }
  }

  // Last, so a failure above leaves the person able to retry: delete_account
  // is safe to run again.
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { ok: false, code: "error", message: authError.message };

  return { ok: true, scope, photosRemoved };
}
