"use server";

import { redirect } from "next/navigation";
import { deleteAccount, signedInRecently } from "@/lib/account-deletion";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Deleting an account from the website (PLAN.md §9 W7, M6) — the page Google
 * Play's Data safety form links to, and the way to delete without the app.
 * The same rules as the app's route (app/api/app/v1/account/delete): the user
 * comes from the session, never the form; they prove it is them again first
 * (password or emailed code); delete_account() (0033) decides what goes.
 */

export type DeleteState = { error: string | null };

const MESSAGES = {
  signedOut: "Your session has ended. Sign in again to delete your account.",
  confirm: "Tick the box to confirm you want to delete your account.",
  password: "That password isn't right.",
  code: "That code is wrong or has expired. Ask for a new one.",
  rateLimited: "Too many tries. Wait a few minutes, then try again.",
  staff: "Hornbill staff accounts are removed by an administrator.",
  notFound: "We couldn't find an account to delete.",
  failed: "Couldn't delete your account. Nothing was lost; try again.",
} as const;

function proofError(error: { code?: string; status?: number }, method: "password" | "code"): string {
  if (error.status === 429 || error.code === "over_request_rate_limit") return MESSAGES.rateLimited;
  return method === "password" ? MESSAGES.password : MESSAGES.code;
}

/** Emails a sign-in code to the signed-in person, to use instead of a password. */
export async function sendDeletionCodeAction(): Promise<DeleteState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: MESSAGES.signedOut };

  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    return {
      error:
        error.status === 429 || error.code === "over_email_send_rate_limit"
          ? "Wait a minute before asking for another code."
          : "Couldn't send a code. Try again, or use your password.",
    };
  }
  return { error: null };
}

export async function deleteAccountAction(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: MESSAGES.signedOut };

  if (form.get("confirm") !== "on") return { error: MESSAGES.confirm };

  // A fresh sign-in, for the same reason as the app: a browser left signed in
  // on a shared computer must not be enough to delete a business.
  const method = form.get("method") === "code" ? "code" : "password";
  const secret = String(form.get(method === "code" ? "code" : "password") ?? "").trim();
  if (!secret) return { error: method === "code" ? MESSAGES.code : MESSAGES.password };

  const { data, error } =
    method === "password"
      ? await supabase.auth.signInWithPassword({ email: user.email, password: secret })
      : await supabase.auth.verifyOtp({ email: user.email, token: secret, type: "email" });
  if (error) return { error: proofError(error, method) };
  // The proof must be for the person whose session this is, and a sign-in from
  // moments ago — never trusted from anything the browser sent.
  if (data.user?.id !== user.id || !data.session || !signedInRecently(data.session.access_token)) {
    return { error: MESSAGES.signedOut };
  }

  const result = await deleteAccount(createAdminClient(), user.id);
  if (!result.ok) {
    if (result.code === "staff") return { error: MESSAGES.staff };
    if (result.code === "not_found") return { error: MESSAGES.notFound };
    console.error("web account deletion failed", { userId: user.id, code: result.code, message: result.message });
    return { error: MESSAGES.failed };
  }

  // The user no longer exists; this clears the browser's session cookies.
  await supabase.auth.signOut().catch(() => undefined);
  redirect(`/account/delete?done=${result.scope}`);
}
