import { createServerSupabase } from "@/lib/supabase/server";
import { batchCsv, type BatchCsvRow } from "@/lib/stock";

/**
 * The file the supplier prints from (D-026).
 *
 * One row per card: the batch it belongs to, the serial to print under the QR,
 * which SKU it is, and the URL the QR must encode. The supplier never sees a
 * customer, because there is no customer yet — these cards are printed
 * generically and sit on a shelf until somebody buys one.
 *
 * Gated by the `staff` table server-side rather than by the layout: a URL is
 * reachable directly, and the layout's `requireStaff` protects pages, not route
 * handlers. This one matters more than the orders export — it hands out live
 * tokens in bulk, and a token is what makes a card work.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: staff } = await supabase
    .from("staff")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const batchId = url.searchParams.get("batch");
  if (!batchId) return new Response("Which batch?", { status: 400 });

  const { data: batch } = await supabase
    .from("card_batches")
    .select("id, code")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return new Response("Batch not found", { status: 404 });

  const { data: rows } = await supabase
    .from("nfc_tags")
    .select("serial, variant, token")
    .eq("batch_id", batchId)
    .order("serial");

  // The site URL is what gets printed and, separately, locked onto a chip. If it
  // is wrong here, every card in the run is wrong permanently — there is no
  // reprinting a locked chip — so an unset value fails loudly rather than
  // producing a file full of `/t/…` with no host in front of it.
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) {
    return new Response(
      "NEXT_PUBLIC_SITE_URL is not set. Refusing to export QR URLs that would be printed wrong.",
      { status: 500 },
    );
  }

  const csv = batchCsv(batch.code, (rows ?? []) as BatchCsvRow[], site);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="taptap-batch-${batch.code}.csv"`,
      // Never cached anywhere. It is a list of live tokens.
      "cache-control": "no-store",
    },
  });
}
