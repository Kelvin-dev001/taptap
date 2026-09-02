"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/staff";
import { transitionBlockedReason, isOrderStatus, ORDER_STATUS_META } from "@/lib/orders";
import { isOfflineMethod, OFFLINE_METHOD_LABELS } from "@/lib/payments";
import { isQuoteStatus, type QuoteStatusValue } from "@/lib/quotes";
import {
  settlePayment,
  SETTLEABLE_PAYMENT_COLUMNS,
  type SettleablePayment,
} from "@/lib/provisioning";

export type OpsResult = { error?: string; success?: string };

/**
 * Advance an order to another stage.
 *
 * The transition rules come from `lib/orders.ts`, which is tested, rather than
 * being restated here or in SQL. The database's job is the other half: a trigger
 * on `orders` writes the `order_events` row, so history is a guarantee rather
 * than something this function has to remember.
 *
 * `requireStaff` runs before anything else, and RLS enforces it again at the
 * table — the check here produces a good error message, the policy is what
 * actually stops a non-staff caller.
 */
export async function advanceOrderAction(
  _prev: OpsResult,
  formData: FormData,
): Promise<OpsResult> {
  await requireStaff();

  const orderId = String(formData.get("orderId") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!orderId) return { error: "No order given." };
  if (!isOrderStatus(to)) return { error: "Unknown stage." };

  const supabase = await createServerSupabase();

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, status, payments(status)")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found." };

  if (!isOrderStatus(order.status)) return { error: "Order is in an unknown stage." };

  const isPaid = ((order.payments ?? []) as { status: string }[]).some(
    (p) => p.status === "paid",
  );

  // Re-checked server-side against the CURRENT status and the CURRENT payment,
  // not what the form was rendered with. Two staff working the same board would
  // otherwise be able to apply a move that was legal when the page loaded and is
  // not any more — and hiding a button is presentation, never enforcement.
  const blocked = transitionBlockedReason(order.status, to, isPaid);
  if (blocked) {
    return { error: `${order.number}: ${blocked}` };
  }

  const { error } = await supabase.from("orders").update({ status: to }).eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/board");
  revalidatePath("/admin");

  return { success: `${order.number} moved to ${ORDER_STATUS_META[to].label}.` };
}

/**
 * Record a payment taken outside M-Pesa (D-021).
 *
 * Cash at a meeting, a bank transfer, a Paybill payment the customer made by
 * hand. Without this, an offline sale can never leave `content_received`
 * (UNPAID_CEILING) and never provisions an identity, so the customer has paid
 * and owns nothing.
 *
 * Provisioning runs through `settlePayment` — the SAME function Safaricom's
 * callback calls. That is the whole point: an offline customer must end up with
 * exactly what an STK customer does, including the `payment_tags` rows that make
 * a later duplicate harmless, and a second implementation would eventually
 * disagree with the first about what a payment buys.
 *
 * `recorded_by` and `recorded_at` name who did it. `payments` has no UPDATE
 * policy for `authenticated` and is written only by the service role, so the row
 * is append-only in practice and is the audit record.
 *
 * Staff-only, and never exposed to customers: `requireStaff` gates it and fails
 * closed on a missing schema (D-020).
 */
export async function recordOfflinePaymentAction(
  _prev: OpsResult,
  formData: FormData,
): Promise<OpsResult> {
  const staff = await requireStaff();

  const orderId = String(formData.get("orderId") ?? "");
  const method = String(formData.get("method") ?? "");
  const note = String(formData.get("reference") ?? "").trim();

  if (!orderId) return { error: "No order given." };
  if (!isOfflineMethod(method)) return { error: "Choose how it was paid." };

  const supabase = await createServerSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select("id, number, account_id, amount_kes, quantity, status, payments(status)")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found." };

  if (order.status === "cancelled") {
    return { error: `${order.number} is cancelled. Reinstating it is a conversation, not a payment.` };
  }

  const payments = (order.payments ?? []) as { status: string }[];
  if (payments.some((p) => p.status === "paid")) {
    return { error: `${order.number} is already paid for.` };
  }

  // The service role writes payments (0004 has no insert policy), so this is
  // the one place in the ops console that steps outside the staff RLS session.
  const admin = createAdminClient();
  const { data: payment, error: insertError } = await admin
    .from("payments")
    .insert({
      account_id: order.account_id,
      provider: method,
      // `reference` is UNIQUE and normally holds Daraja's checkout id. An
      // offline payment has none, so it carries the order number plus whatever
      // the staff member typed, which is usually a bank or M-Pesa reference.
      reference: note ? `offline:${order.number}:${note}` : `offline:${order.number}`,
      amount: order.amount_kes,
      status: "pending",
      kind: "hardware",
      quantity: order.quantity,
      order_id: order.id,
      recorded_by: staff.userId,
      recorded_at: new Date().toISOString(),
    })
    .select(SETTLEABLE_PAYMENT_COLUMNS)
    .single();

  if (insertError || !payment) {
    // 23505 = unique_violation: this exact reference has been recorded before.
    if (insertError?.code === "23505") {
      return { error: "That reference has already been recorded against this order." };
    }
    return { error: "Could not record the payment." };
  }

  // Inserted as pending and settled immediately, rather than inserted as paid.
  // It costs one extra write and means offline money travels the identical path
  // to M-Pesa money, right down to the order of operations.
  await settlePayment(admin, payment as SettleablePayment);

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/board");
  revalidatePath("/admin");

  return {
    success: `${OFFLINE_METHOD_LABELS[method]} payment recorded for ${order.number}. Identities provisioned.`,
  };
}

/**
 * Move a quote request along.
 *
 * Column grants (0019) mean staff set the status and stamp their own name on it,
 * and can never rewrite what the enquirer actually said. That distinction is the
 * same one 0012 drew for leads and 0017 for orders: annotate, never edit the
 * record of what someone told us.
 */
export async function setQuoteStatusAction(
  _prev: OpsResult,
  formData: FormData,
): Promise<OpsResult> {
  const staff = await requireStaff();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return { error: "No quote given." };
  if (!isQuoteStatus(status)) return { error: "Unknown status." };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("quote_requests")
    .update({
      status: status as QuoteStatusValue,
      handled_by: staff.userId,
      handled_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/quotes");
  return { success: "Updated." };
}

/**
 * Notes on an order.
 *
 * Free text rather than structured fields on purpose: this is where the reason
 * for a delay or a customer's odd request goes, and a form cannot anticipate
 * those. Column grants (0017) mean staff can write this and never the amount.
 */
export async function saveOrderNotesAction(
  _prev: OpsResult,
  formData: FormData,
): Promise<OpsResult> {
  await requireStaff();

  const orderId = String(formData.get("orderId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!orderId) return { error: "No order given." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("orders").update({ notes }).eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: "Note saved." };
}
