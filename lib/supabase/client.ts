import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client for client components (login form, uploads).
 *
 * The guard matters more than it looks. `NEXT_PUBLIC_*` variables are inlined
 * into the browser bundle **at build time**, so changing them in Vercel has no
 * effect on an already-built deployment — it must be redeployed. When they are
 * missing, `createBrowserClient(undefined, undefined)` throws from inside the
 * Supabase SDK with a message that says nothing about the real cause, and
 * signing in simply appears to do nothing.
 *
 * Failing loudly here turns that into a diagnosis.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]
      .filter(Boolean)
      .join(" and ");
    throw new Error(
      `Supabase is not configured: ${missing} is missing from this build. ` +
        `These are inlined at build time, so set them in the hosting environment ` +
        `and redeploy — updating them alone will not fix an existing deployment.`,
    );
  }

  return createBrowserClient(url, anonKey);
}
