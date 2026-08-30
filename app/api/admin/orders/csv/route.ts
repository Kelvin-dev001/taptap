import { createServerSupabase } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { isOrderStatus, ORDER_STATUS_META, daysAtStage, isStuck } from "@/lib/orders";

/**
 * Order export for staff.
 *
 * Gated by the `staff` table server-side rather than by the layout: a URL is
 * reachable directly, and the layout's `requireStaff` protects pages, not route
 * handlers. Without this check the export would hand every customer's order
 * history to any signed-in user who guessed the path.
 *
 * Honours the same filters as the screen, so "export what I am looking at" is
 * actually what happens.
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
  const status = url.searchParams.get("status");
  const paid = url.searchParams.get("paid");
  const query = (url.searchParams.get("q") ?? "").trim();

  let request_ = supabase
    .from("orders_overview")
    .select("*")
    .order("created_at", { ascending: false })
    // A bound rather than everything: an unbounded export on a growing table is
    // a timeout waiting to happen, and the count is stated in the filename.
    .limit(5000);

  if (status && isOrderStatus(status)) request_ = request_.eq("status", status);
  if (paid === "paid") request_ = request_.eq("payment_status", "paid");
  if (paid === "unpaid") request_ = request_.or("payment_status.is.null,payment_status.neq.paid");
  if (query) {
    const safe = query.replace(/[%,()]/g, " ");
    request_ = request_.or(
      `number.ilike.%${safe}%,business_name.ilike.%${safe}%,contact_name.ilike.%${safe}%`,
    );
  }

  const { data, error } = await request_;
  if (error) return new Response(`Could not build export: ${error.message}`, { status: 500 });

  const rows = (data ?? []).map((o) => [
    o.number,
    o.business_name,
    o.contact_name ?? "",
    o.contact_phone ?? "",
    o.product_name,
    String(o.quantity),
    String(o.amount_kes),
    ORDER_STATUS_META[o.status as keyof typeof ORDER_STATUS_META]?.label ?? o.status,
    o.payment_status ?? "unpaid",
    String(o.identity_count),
    String(daysAtStage(o.updated_at, o.created_at)),
    isStuck(o) ? "yes" : "no",
    new Date(o.created_at).toISOString(),
  ]);

  const csv = toCsv(
    [
      "order",
      "business",
      "contact",
      "phone",
      "product",
      "quantity",
      "amount_kes",
      "stage",
      "payment",
      "identities",
      "days_at_stage",
      "stuck",
      "created_at",
    ],
    rows,
  );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="taptap-orders-${rows.length}.csv"`,
      // Contains customer contact details across every account.
      "cache-control": "no-store, private",
    },
  });
}
