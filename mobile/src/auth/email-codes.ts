import { supabase } from "@/api/supabase";
import { env } from "@/config/env";

/**
 * Asking Supabase to email a code (PLAN.md §4.4). The same email also carries
 * a link. The link always points at the website's /auth/confirm, never into
 * the app, so it works wherever it is opened (W8).
 */
export function emailLinkTo(next: string): string {
  return `${env.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/** A sign-in code. The app never creates accounts: an unknown email is an error. */
export function sendSignInCode(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: emailLinkTo("/dashboard") },
  });
}

/**
 * A password-reset code. Supabase answers the same whether or not the email
 * has an account, so nobody can use this to find out who is a customer.
 */
export function sendResetCode(email: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: emailLinkTo("/reset-password") });
}
