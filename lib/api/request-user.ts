import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Who is calling an app route (docs/mobile/PLAN.md §9 W3, §4.11).
 *
 * The mobile app has no cookies. It sends its Supabase access token as
 * `Authorization: Bearer <token>`, and this turns that into the same thing a
 * cookie session gives the web: the user, and a client that queries AS them,
 * so RLS applies to every read and write that follows.
 *
 * The token is checked with `auth.getUser(token)`, which asks Supabase Auth
 * rather than only reading the token: a signed-out or deleted user is refused
 * even while their token has time left. No service-role key is involved.
 */

export type RequestUser = { user: User; supabase: SupabaseClient };

/** The token from an `Authorization: Bearer …` header, or null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(header);
  return match ? match[1] : null;
}

export async function requestUser(request: Request): Promise<RequestUser | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase env vars are not configured.");

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, supabase };
}
