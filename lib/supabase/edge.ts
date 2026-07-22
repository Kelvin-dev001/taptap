import { createClient } from "@supabase/supabase-js";

// Lightweight anon client for the public tap/redirect path. No session
// persistence — the redirect service is stateless and only calls the public
// SECURITY DEFINER RPCs (resolve_slug, log_event).
export function createEdgeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase env vars are not configured.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
