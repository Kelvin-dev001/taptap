import { cache } from "react";
import { createEdgeClient } from "@/lib/supabase/edge";
import type { PublicPage } from "@/lib/profile";

/**
 * Fetch a published page, deduped per request.
 *
 * The tap path renders `generateMetadata` and the page component in the same
 * request, and both need the page. UI-11 added the metadata function without
 * noticing it doubled the database round trips on the single most
 * latency-critical route in the product — the one a customer waits on with a
 * phone held against a card.
 *
 * React's `cache()` memoises for the lifetime of one request, so the two
 * callers share a single query. It is not a cross-request cache: a publish is
 * still visible immediately.
 */
export const getPublicPage = cache(async (slug: string): Promise<PublicPage | null> => {
  const supabase = createEdgeClient();
  const { data } = await supabase.rpc("get_public_page", { p_slug: slug });
  return (data as PublicPage | null) ?? null;
});
