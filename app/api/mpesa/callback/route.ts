import { createAdminClient } from "@/lib/supabase/admin";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Daraja expects a 200 with this shape.
function accepted() {
  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request) {
  let body: {
    Body?: { stkCallback?: { CheckoutRequestID?: string; ResultCode?: number } };
  } = {};
  try {
    body = await request.json();
  } catch {
    return accepted();
  }

  const cb = body?.Body?.stkCallback;
  const checkoutId = cb?.CheckoutRequestID;
  const resultCode = cb?.ResultCode;
  if (!checkoutId) return accepted();

  const admin = createAdminClient();

  // Match to a payment we created; unknown references are ignored.
  const { data: payment } = await admin
    .from("payments")
    .select("id, account_id, plan_code, status")
    .eq("reference", checkoutId)
    .single();
  if (!payment) return accepted();
  if (payment.status === "paid") return accepted(); // idempotent replay

  if (resultCode === 0) {
    await admin
      .from("payments")
      .update({ status: "paid", raw: body })
      .eq("id", payment.id);

    const { data: sub } = await admin
      .from("subscriptions")
      .select("current_period_end")
      .eq("account_id", payment.account_id)
      .single();

    const now = Date.now();
    const base = sub?.current_period_end
      ? Math.max(now, new Date(sub.current_period_end).getTime())
      : now;
    const periodEnd = new Date(base + YEAR_MS).toISOString();

    await admin
      .from("subscriptions")
      .update({
        plan: payment.plan_code,
        plan_code: payment.plan_code,
        status: "active",
        provider: "mpesa",
        external_ref: checkoutId,
        current_period_end: periodEnd,
      })
      .eq("account_id", payment.account_id);
  } else {
    await admin
      .from("payments")
      .update({ status: "failed", raw: body })
      .eq("id", payment.id);
  }

  return accepted();
}
