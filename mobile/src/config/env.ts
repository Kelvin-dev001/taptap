/**
 * The public values the app is built with (PLAN.md §4.1 #2).
 *
 * EXPO_PUBLIC_ variables are copied into the JavaScript bundle at build time,
 * so anyone can read them out of the app. Only values that are public by
 * design may ever be one: the Supabase URL and publishable key (RLS is what
 * protects the data), the website's address, the Sentry DSN.
 *
 * Local runs read mobile/.env.local; EAS builds read the EAS environment for
 * their profile. Each must be read as `process.env.EXPO_PUBLIC_X` in full —
 * Expo only inlines that exact shape.
 */
const DEFAULT_SITE_URL = "https://taptap.hornbilltech.co.ke";

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "",
  /** The website. Emailed links always point here, never into the app. */
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, ""),
} as const;

/** False in a build made without its Supabase settings; sign-in says so. */
export const envReady = Boolean(env.supabaseUrl && env.supabaseKey);
