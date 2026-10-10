"use server";

import { redirect } from "next/navigation";
import { asOtpType } from "@/lib/email-link";
import { safeNext } from "@/lib/safe-next";
import { createServerSupabase } from "@/lib/supabase/server";

const INVALID = "This link is not valid. Request a new one.";

function toLogin(reason: string): never {
  redirect(`/login?error=${encodeURIComponent(reason)}`);
}

/**
 * Uses an emailed link's one-time token — only when a person presses Continue.
 *
 * Everything arrives from the form, so it is as untrusted as the URL it came
 * from: the type is checked against the known set, and `next` goes through
 * safeNext again rather than trusting that the page already did.
 */
export async function confirmEmailLink(formData: FormData): Promise<void> {
  const tokenHash = formData.get("token_hash");
  const type = asOtpType(formData.get("type") as string | null);
  const next = safeNext(formData.get("next") as string | null);
  if (typeof tokenHash !== "string" || !tokenHash || !type) toLogin(INVALID);

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) toLogin(error.message);

  redirect(next);
}
