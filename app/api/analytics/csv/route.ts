import { createServerSupabase } from "@/lib/supabase/server";
import { loadBillingContext } from "@/lib/billing-context";
import { toCsv } from "@/lib/csv";
import { parseRange } from "@/lib/metrics";
import type { Analytics } from "@/lib/analytics";

/**
 * Daily analytics export.
 *
 * Exports the same aggregates the screen shows, not raw events: an event-level
 * dump would carry per-visitor rows into a spreadsheet with no purpose that the
 * daily breakdown does not already serve, and needlessly widens the blast
 * radius of a shared file.
 *
 * Scoping is by RLS through get_analytics — a page id from the query string
 * cannot reach another account's data, because the RPC filters on auth.uid().
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Export is part of the full report (D-018). Hiding the button is presentation;
  // this is the enforcement — the URL is guessable and would otherwise hand the
  // paid artefact to any signed-in account that typed it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  const { entitlements } = await loadBillingContext(supabase, profile?.account_id);
  if (entitlements.analytics !== "full") {
    return new Response("Export needs an active device on this account.", { status: 403 });
  }

  const url = new URL(request.url);
  const days = parseRange(url.searchParams.get("range") ?? undefined);
  const pageId = url.searchParams.get("page");

  const { data, error } = await supabase.rpc("get_analytics", {
    p_days: days,
    p_page_id: pageId || null,
  });
  if (error) return new Response(`Could not build export: ${error.message}`, { status: 500 });

  const analytics = (data ?? null) as Analytics | null;
  if (!analytics) return new Response("No data", { status: 404 });

  const rows = (analytics.daily ?? []).map((d) => {
    const opens = d.view + d.scan;
    const confirmed = d.download + d.lead;
    return [
      d.date,
      String(d.tap),
      String(d.scan),
      String(d.view),
      String(d.click),
      String(d.download),
      String(d.lead),
      String(opens),
      String(confirmed),
      // Blank rather than 0 when there is nothing to divide by: a rate out of
      // zero is unknown, and 0% in a spreadsheet reads as a measured result.
      opens > 0 ? ((confirmed / opens) * 100).toFixed(1) : "",
    ];
  });

  const csv = toCsv(
    [
      "date",
      "nfc_taps",
      "qr_scans",
      "profile_views",
      "button_clicks",
      "contacts_saved",
      "leads",
      "page_opens",
      "confirmed_actions",
      "confirmed_rate_percent",
    ],
    rows,
  );

  const scope = pageId ? `profile-${pageId.slice(0, 8)}` : "all-profiles";
  const filename = `taptap-analytics-${scope}-${days}d.csv`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      // Contains business performance data — never cache in a shared proxy.
      "cache-control": "no-store, private",
    },
  });
}
