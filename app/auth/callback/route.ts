import { NextResponse } from "next/server";
import { safeNext } from "@/lib/safe-next";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Where every authenticated link lands.
 *
 * Two flows arrive here, and they are not interchangeable:
 *
 *   token_hash + type — EMAIL links (magic link, signup confirmation, recovery,
 *     email change). Verified with verifyOtp. Carries no client-side secret, so
 *     it works no matter where the link is opened.
 *
 *   code — OAuth (Google). PKCE, exchanged for a session. Correct here because
 *     the whole round trip happens in the browser that started it, so the code
 *     verifier is still where the SDK left it.
 *
 * WHY EMAIL LINKS ARE NOT PKCE: the verifier lives in the browser that
 * REQUESTED the link, and email links are usually opened somewhere else — a
 * mail app's in-app webview, a different browser, or a different device. None
 * of those have it, and the exchange fails with "PKCE code verifier not found
 * in storage". The cruel part is that it succeeds when testing in the same tab,
 * so it looks fine until real people use it.
 */

/** The only OTP types this route will act on. */
const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/**
 * `type` comes from a URL in an email, so it is attacker-controllable. Checking
 * it against the known set keeps an arbitrary string out of the auth SDK.
 */
export function asOtpType(raw: string | null): EmailOtpType | null {
  return raw && EMAIL_OTP_TYPES.has(raw as EmailOtpType) ? (raw as EmailOtpType) : null;
}

export { safeNext };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, url.origin));

  // Supabase reports failures (expired or already-used links) on the query
  // string rather than as an exception. Surface the real reason instead of
  // leaving someone on a blank page.
  const providerError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return fail(providerError);

  const supabase = await createServerSupabase();

  // --- Email links -----------------------------------------------------------
  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash) {
    const type = asOtpType(url.searchParams.get("type"));
    if (!type) return fail("This link is not valid. Request a new one.");

    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail(error.message);
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // --- OAuth -----------------------------------------------------------------
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL("/login", url.origin));
}
