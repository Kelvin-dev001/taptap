import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "./safe-next";

/**
 * Emailed sign-in links (magic link, sign-up confirmation, password reset).
 *
 * Shared by /auth/callback, which still accepts the old link format so emails
 * already in inboxes keep working, and /auth/confirm, where the email templates
 * now point (W8, docs/mobile/PLAN.md §9).
 */

/** The only OTP types an emailed link may carry. */
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
export function asOtpType(raw: string | null | undefined): EmailOtpType | null {
  return raw && EMAIL_OTP_TYPES.has(raw as EmailOtpType) ? (raw as EmailOtpType) : null;
}

/**
 * Where an emailed link lands once it has been used.
 *
 * The templates build the link from the project's Site URL and pass along the
 * redirect the sign-in request asked for as `redirect_to` instead of appending
 * to it. A link appended to the redirect breaks the day Supabase hands the
 * template one without a query string; this one cannot. `next` travels inside
 * that redirect (`…/auth/confirm?next=/admin`). A plain `next` is honoured too,
 * for links built by hand.
 *
 * Only a path survives, and only through safeNext: a hostile `redirect_to` can
 * at worst choose another page on this site.
 */
export function emailLinkNext(params: URLSearchParams): string {
  const direct = params.get("next");
  if (direct) return safeNext(direct);

  const redirectTo = params.get("redirect_to");
  if (redirectTo) {
    try {
      return safeNext(new URL(redirectTo).searchParams.get("next"));
    } catch {
      // Not a URL; fall through to the default.
    }
  }
  return safeNext(null);
}

export type EmailLinkTarget =
  /** A link this page acts on — but only once the person presses Continue. */
  | { kind: "confirm"; tokenHash: string; type: EmailOtpType; next: string }
  /** An OAuth code or a provider error: /auth/callback already handles both. */
  | { kind: "callback"; query: string }
  | { kind: "invalid" }
  | { kind: "none" };

/** Decides what /auth/confirm does with the query string it was opened with. */
export function emailLinkTarget(params: URLSearchParams): EmailLinkTarget {
  const tokenHash = params.get("token_hash");
  if (!tokenHash) {
    if (params.has("code") || params.has("error") || params.has("error_description")) {
      return { kind: "callback", query: params.toString() };
    }
    return { kind: "none" };
  }
  const type = asOtpType(params.get("type"));
  if (!type) return { kind: "invalid" };
  return { kind: "confirm", tokenHash, type, next: emailLinkNext(params) };
}
