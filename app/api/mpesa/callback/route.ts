import { createAdminClient } from "@/lib/supabase/admin";
import { renewedTermEnd } from "@/lib/pricing";

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
    .select("id, account_id, plan_code, status, kind, order_id")
    .eq("reference", checkoutId)
    .single();
  if (!payment) return accepted();
  if (payment.status === "paid") return accepted(); // idempotent replay

  if (resultCode !== 0) {
    await admin.from("payments").update({ status: "failed", raw: body }).eq("id", payment.id);
    return accepted();
  }

  // Marked paid BEFORE provisioning, deliberately. The two failure modes are not
  // equal: a crash between the two leaves a payment that is paid with nothing
  // provisioned — which the customer sees immediately on Billing and reports —
  // whereas provisioning first would let a replayed callback silently hand out a
  // second free year, or a second free card, with nobody ever noticing.
  // Visible-and-fixable beats invisible.
  await admin.from("payments").update({ status: "paid", raw: body }).eq("id", payment.id);

  if (payment.kind === "hardware") {
    await provisionForOrder(admin, payment.id, payment.order_id);
  } else if (payment.kind === "renewal") {
    await activateIdentities(admin, payment.id);
  } else {
    // Sprint 4 per-account plan payment. Kept so a callback for a checkout
    // started before the per-identity rework still activates what it bought.
    await activateLegacySubscription(admin, payment.account_id, payment.plan_code, checkoutId);
  }

  return accepted();
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Create the identities a hardware order paid for (D-019).
 *
 * The term starts now rather than at delivery, so production time comes out of
 * the customer's twelve months. That is a deliberate choice, and the reason
 * `orders_deactivate_on_cancel` exists: a cancelled order must not leave a live
 * card behind.
 *
 * Token selection and the pool race live in `provision_identities` — atomic in
 * the database, because two concurrent callbacks drawing from the same pool of
 * blanks would otherwise hand one physical card to two customers.
 */
async function provisionForOrder(admin: Admin, paymentId: string, orderId: string | null) {
  if (!orderId) return;

  // Belt and braces behind the already-paid early return: if this somehow runs
  // twice, it must not mint a second set of cards.
  const { data: existing } = await admin
    .from("payment_tags")
    .select("tag_id")
    .eq("payment_id", paymentId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: order } = await admin
    .from("orders")
    .select("id, account_id, quantity, product_code, products(kind, bundled_months)")
    .eq("id", orderId)
    .single();
  if (!order) return;

  const product = (order.products ?? null) as { kind?: string; bundled_months?: number } | null;

  const { data: tagIds, error } = await admin.rpc("provision_identities", {
    p_account_id: order.account_id,
    p_kind: product?.kind ?? "card",
    p_count: order.quantity,
    p_months: product?.bundled_months ?? 12,
  });
  if (error || !Array.isArray(tagIds) || tagIds.length === 0) return;

  await admin
    .from("payment_tags")
    .insert((tagIds as string[]).map((tagId) => ({ payment_id: paymentId, tag_id: tagId })));
}

/**
 * Extend every identity this payment covers.
 *
 * The set comes from `payment_tags`, recorded at checkout — not recomputed here.
 * That is what makes a replayed callback safe: it extends the same devices the
 * customer actually paid for, even if they have since claimed or disabled
 * others. `renewedTermEnd` extends from the later of now and the existing end,
 * so paying early adds a year rather than discarding time already bought.
 */
async function activateIdentities(admin: Admin, paymentId: string) {
  const { data: links } = await admin
    .from("payment_tags")
    .select("tag_id")
    .eq("payment_id", paymentId);

  const tagIds = (links ?? []).map((l) => l.tag_id as string);
  if (tagIds.length === 0) return;

  const { data: tags } = await admin
    .from("nfc_tags")
    .select("id, term_start, term_end")
    .in("id", tagIds);

  const now = new Date();
  for (const tag of tags ?? []) {
    await admin
      .from("nfc_tags")
      .update({
        term_start: tag.term_start ?? now.toISOString(),
        term_end: renewedTermEnd(tag.term_end, now).toISOString(),
      })
      .eq("id", tag.id);
  }
}

/** The pre-D-018 path: activate an account-level annual plan. */
async function activateLegacySubscription(
  admin: Admin,
  accountId: string,
  planCode: string | null,
  checkoutId: string,
) {
  if (!planCode) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("current_period_end")
    .eq("account_id", accountId)
    .single();

  const now = Date.now();
  const base = sub?.current_period_end
    ? Math.max(now, new Date(sub.current_period_end).getTime())
    : now;
  const periodEnd = new Date(base + YEAR_MS).toISOString();

  await admin
    .from("subscriptions")
    .update({
      plan: planCode,
      plan_code: planCode,
      status: "active",
      provider: "mpesa",
      external_ref: checkoutId,
      current_period_end: periodEnd,
    })
    .eq("account_id", accountId);
}
