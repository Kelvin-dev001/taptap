import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Email confirmation landing point.
 *
 * Supabase mails a link carrying a one-time `code`, which is worthless until it
 * is exchanged for a session. Nothing in the app did that exchange, so a
 * confirmation link landed on the marketing page at `/?code=…`, the code was
 * silently ignored, and the new user was never signed in — the account existed
 * but could not be entered. This route is the missing half.
 *
 * It handles every link Supabase can send here: signup confirmation, magic
 * link, OAuth, password recovery and email-change confirmation all arrive as
 * either a `code` to exchange or an `error` to report.
 */

/**
 * Only ever redirect within this site.
 *
 * `next` arrives from a URL in an email, so it is attacker-controllable: a
 * crafted link could otherwise bounce a freshly-authenticated user to another
 * origin. Requiring a single leading slash rejects both absolute URLs
 * (`https://evil.example`) and protocol-relative ones (`//evil.example`), which
 * browsers treat as absolute.
 */
export function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  // Supabase reports failures (expired or already-used links) on the query
  // string rather than as an exception. Surface the real reason instead of
  // leaving someone on a blank page.
  const providerError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(providerError)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Most often an expired link or one already opened once — both are
    // recoverable by signing in or requesting a new email, so say so plainly.
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // exchangeCodeForSession writes the session cookies through the server
  // client, so the redirect below lands already signed in.
  return NextResponse.redirect(new URL(next, url.origin));
}
