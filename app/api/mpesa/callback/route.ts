import { createAdminClient } from "@/lib/supabase/admin";
import {
  settlePayment,
  failPayment,
  SETTLEABLE_PAYMENT_COLUMNS,
  type SettleablePayment,
} from "@/lib/provisioning";

// Daraja expects a 200 with this shape.
function accepted() {
  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * Safaricom's callback.
 *
 * Thin on purpose since Sprint 7. Everything it used to do inline now lives in
 * `lib/provisioning.ts`, because the checkout's status poll and staff
 * mark-as-paid have to do exactly the same thing and a second implementation
 * would eventually disagree with this one about what a payment provisions.
 *
 * Still the primary path. The poll exists for the case where this never arrives.
 */
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
    .select(SETTLEABLE_PAYMENT_COLUMNS)
    .eq("reference", checkoutId)
    .single();
  if (!payment) return accepted();

  if (resultCode !== 0) {
    // A failure after a success would be a replay of an older attempt; never
    // downgrade a payment that has already been settled.
    if (payment.status !== "paid") {
      await failPayment(admin, payment.id, body);
    }
    return accepted();
  }

  await settlePayment(admin, payment as SettleablePayment, body);
  return accepted();
}
