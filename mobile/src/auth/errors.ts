import { isAuthApiError, isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";

/**
 * Every sign-in failure, as one plain-English message (PLAN.md §4.4). Screens
 * never show Supabase's own text: it is English-only, sometimes technical
 * ("Token has expired or is invalid"), and changes between releases.
 */
export type AuthErrorKey =
  | "auth.errors.offline"
  | "auth.errors.wrongPassword"
  | "auth.errors.noAccount"
  | "auth.errors.wrongCode"
  | "auth.errors.emailWait"
  | "auth.errors.tooMany"
  | "auth.errors.notConfirmed"
  | "auth.errors.weakPassword"
  | "auth.errors.samePassword"
  | "auth.errors.blocked"
  | "auth.errors.invalidEmail"
  | "auth.errors.unknown";

const BY_CODE: Partial<Record<string, AuthErrorKey>> = {
  invalid_credentials: "auth.errors.wrongPassword",
  // Asking for a code with shouldCreateUser: false, for an email with no account.
  otp_disabled: "auth.errors.noAccount",
  user_not_found: "auth.errors.noAccount",
  // Supabase uses this one code for a wrong code and an expired one.
  otp_expired: "auth.errors.wrongCode",
  over_email_send_rate_limit: "auth.errors.emailWait",
  over_request_rate_limit: "auth.errors.tooMany",
  email_not_confirmed: "auth.errors.notConfirmed",
  weak_password: "auth.errors.weakPassword",
  same_password: "auth.errors.samePassword",
  user_banned: "auth.errors.blocked",
  email_address_invalid: "auth.errors.invalidEmail",
};

export function authErrorKey(error: unknown): AuthErrorKey {
  if (isAuthRetryableFetchError(error)) return "auth.errors.offline";
  // fetch itself failing, before supabase-js could wrap it.
  if (error instanceof TypeError && /network/i.test(error.message)) return "auth.errors.offline";
  if (isAuthError(error)) {
    const byCode = error.code ? BY_CODE[error.code] : undefined;
    if (byCode) return byCode;
    if (isAuthApiError(error) && error.status === 429) return "auth.errors.tooMany";
  }
  return "auth.errors.unknown";
}
