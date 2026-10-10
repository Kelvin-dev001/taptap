/**
 * Checks made on the phone before anything is sent. They catch typing slips
 * early; the server still decides.
 */

/** Matches the web's reset form and the Supabase minimum (PLAN.md §11). */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Digits in an emailed sign-in code. Must equal Supabase's "Email OTP Length"
 * (Authentication → Sign In / Providers → Email). It was 8 on 9 Oct 2026; the
 * plan sets it to 6 (PROGRESS.md, M1 dashboard changes).
 */
export const CODE_LENGTH = 6;

/** Lowercased and trimmed, as Supabase stores it. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Enough to catch a slip ("name@gmail", "name gmail.com"); not RFC 5322. */
export function isPlausibleEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(raw));
}

/** Digits only, at most CODE_LENGTH — pasted codes often carry spaces or dashes. */
export function sanitiseCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export type PasswordProblem = "tooShort" | "mismatch" | null;

export function newPasswordProblem(password: string, confirmation: string): PasswordProblem {
  if (password.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (password !== confirmation) return "mismatch";
  return null;
}
