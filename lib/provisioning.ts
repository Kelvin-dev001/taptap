/**
 * Turning money into identities — one path, three doors (D-019, D-021).
 *
 * SERVER ONLY. Every function here takes a service-role client, because
 * provisioning writes across account boundaries by design.
 *
 * This logic used to live inside `app/api/mpesa/callback/route.ts`. Sprint 7
 * adds two more callers — the checkout's status poll, and staff recording an
 * offline payment — and the brief is explicit that there must not be a second
 * payment flow. So it moved here unchanged rather than being reimplemented
 * twice. The three doors are:
 *
 *   1. Safaricom's callback          (app/api/mpesa/callback)
 *   2. The STK query poll            (app/dashboard/checkout/actions.ts)
 *   3. Staff marking an order paid   (app/admin/order-actions.ts)
 *
 * All three end up in `settlePayment`, so a payment settled by any of them
 * provisions identically, and a payment settled by two of them provisions once.
 */

import type { createAdminClient } from "./supabase/admin";
import { renewedTermEnd } from "./pricing";

type Admin = ReturnType<typeof createAdminClient>;

export type SettleablePayment = {
  id: string;
  account_id: string;
  status: string;
  kind?: string | null;
  order_id?: string | null;
};

/** Columns `settlePayment` needs. Selected identically by all three callers. */
export const SETTLEABLE_PAYMENT_COLUMNS = "id, account_id, status, kind, order_id";

/**
 * Mark a payment paid and provision whatever it bought.
 *
 * Idempotent at two levels, deliberately. A payment already marked paid returns
 * immediately; and even if it did not, `provisionForOrder` checks `payment_tags`
 * before minting anything. Replayed callbacks are normal, not exceptional —
 * Safaricom retries, and a customer can have the poll and the callback land in
 * the same second.
 *
 * The payment is marked paid BEFORE provisioning, which is the ordering the
 * callback has always used and is kept on purpose. The two failure modes are not
 * equal: a crash between the two leaves a payment that is paid with nothing
 * provisioned, which the customer sees immediately on Billing and reports,
 * whereas provisioning first would let a replay silently hand out a second free
 * card with nobody ever noticing. Visible-and-fixable beats invisible.
 */
export async function settlePayment(
  admin: Admin,
  payment: SettleablePayment,
  raw?: unknown,
): Promise<{ alreadySettled: boolean }> {
  if (payment.status === "paid") return { alreadySettled: true };

  const update: Record<string, unknown> = { status: "paid" };
  if (raw !== undefined) update.raw = raw;
  await admin.from("payments").update(update).eq("id", payment.id);

  if (payment.kind === "hardware") {
    await provisionForOrder(admin, payment.id, payment.order_id ?? null);
  } else if (payment.kind === "renewal") {
    await extendPaidIdentities(admin, payment.id);
  }
  // A payment with neither kind is a Sprint 4 per-account plan row. Those
  // predate D-018, every one of them resolved months ago, and no new row can be
  // created without a kind — so there is nothing left for that branch to do.
  // It was removed rather than carried forward as a plan code the product no
  // longer has a concept of.

  return { alreadySettled: false };
}

/** Record that a payment failed. Separate from settling so neither can be a typo away from the other. */
export async function failPayment(
  admin: Admin,
  paymentId: string,
  raw?: unknown,
): Promise<void> {
  const update: Record<string, unknown> = { status: "failed" };
  if (raw !== undefined) update.raw = raw;
  await admin.from("payments").update(update).eq("id", paymentId);
}

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
async function provisionForOrder(
  admin: Admin,
  paymentId: string,
  orderId: string | null,
): Promise<void> {
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
async function extendPaidIdentities(admin: Admin, paymentId: string): Promise<void> {
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
