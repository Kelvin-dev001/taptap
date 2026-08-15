import { createServerSupabase } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { parseLeadRange, parseLeadStatus, type Lead } from "@/lib/leads";

/**
 * Lead export honouring the filters on screen, so what downloads matches what
 * the owner is looking at.
 *
 * Replaces the per-page-only export at /api/leads/[id]/csv, which is kept for
 * any bookmarked link. Scoped by RLS through get_leads: a page id in the query
 * string cannot reach another account.
 *
 * This file contains customer personal data — name, phone, email — so it is
 * never cacheable, and the owner is its data controller once downloaded.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const days = parseLeadRange(url.searchParams.get("range") ?? undefined);
  const status = parseLeadStatus(url.searchParams.get("status") ?? undefined);
  const pageId = url.searchParams.get("page");

  const { data, error } = await supabase.rpc("get_leads", {
    p_days: days,
    p_page_id: pageId || null,
    p_status: status ?? null,
    p_limit: 5000,
  });
  if (error) return new Response(`Could not build export: ${error.message}`, { status: 500 });

  const leads = (data ?? []) as Lead[];

  const csv = toCsv(
    [
      "received",
      "name",
      "phone",
      "email",
      "company",
      "message",
      "status",
      "note",
      "profile",
      "previous_enquiries",
    ],
    leads.map((l) => [
      l.created_at,
      l.name,
      l.phone,
      l.email,
      l.company,
      l.message,
      l.status,
      l.note,
      l.page_title || `/${l.page_slug}`,
      String(l.repeat_count),
    ]),
  );

  const scope = pageId ? `profile-${pageId.slice(0, 8)}` : "all";
  const filename = `taptap-leads-${scope}${status ? `-${status}` : ""}-${days}d.csv`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store, private",
    },
  });
}
