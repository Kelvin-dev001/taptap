"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/staff";
import {
  transitionBlockedReason,
  isOrderStatus,
  isDispatchMethod,
  pathForProduct,
  ORDER_STATUS_META,
} from "@/lib/orders";
import { parseScan } from "@/lib/stock";
import { isOfflineMethod, OFFLINE_METHOD_LABELS } from "@/lib/payments";
import { isQuoteStatus, type QuoteStatusValue } from "@/lib/quotes";
import {
  settlePayment,
  SETTLEABLE_PAYMENT_COLUMNS,
  type SettleablePayment,
} from "@/lib/provisioning";
import { notifyDispatched } from "@/lib/notifications/notify-dispatch";

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

  // Dispatch is the one move that carries facts with it. Letting it happen here
  // would mean an order could go out with no rider, no waybill and no email to
  // the customer, which is exactly the gap `record_dispatch` (0023) was added to
  // close. Refused server-side rather than merely hidden: the board renders a
  // link to the order page instead of a button, and this is what makes that a
  // rule rather than a decoration.
  if (to === "dispatched") {
    return {
      error: "Dispatch from the order page, so the rider or waybill is recorded.",
    };
  }

  const supabase = await createServerSupabase();

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, status, product_code, quantity, payments(status), order_units(id, tag_id)")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found." };

  if (!isOrderStatus(order.status)) return { error: "Order is in an unknown stage." };

  const isPaid = ((order.payments ?? []) as { status: string }[]).some(
    (p) => p.status === "paid",
  );

  // How many of this order's physical units actually have a card scanned onto
  // them. Read here rather than trusted from the form, for the same reason the
  // status is: the board may have been rendered before a colleague unbound one.
  const units = (order.order_units ?? []) as { id: string; tag_id: string | null }[];
  const binding = {
    total: units.length,
    bound: units.filter((u) => u.tag_id).length,
  };

  // Re-checked server-side against the CURRENT status, the CURRENT payment and
  // the CURRENT cards, not what the form was rendered with. Two staff working
  // the same board would otherwise be able to apply a move that was legal when
  // the page loaded and is not any more — and hiding a button is presentation,
  // never enforcement.
  const blocked = transitionBlockedReason(
    pathForProduct(order.product_code),
    order.status,
    to,
    isPaid,
    binding,
  );
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
 * Send it out, and record who has it.
 *
 * Three things have to happen together and none of them is optional: the facts
 * of the parcel are recorded, the order moves, and the customer is told. Doing
 * them in that order matters. `record_dispatch` writes `dispatched_at`, and the
 * notification RPC returns nothing for an order that has not been dispatched, so
 * a crash between the two leaves an order that staff can see has gone out and
 * can announce again, rather than an email about a parcel still on the bench.
 *
 * The transition itself stays in `lib/orders.ts` and is re-checked here against
 * the CURRENT status, payment and cards, exactly as `advanceOrderAction` does.
 * `record_dispatch` deliberately does not move the status: which moves are legal
 * is tested in TypeScript, and a second copy of that rule in SQL would drift.
 */
export async function dispatchOrderAction(
  _prev: OpsResult,
  formData: FormData,
): Promise<OpsResult> {
  await requireStaff();

  const orderId = String(formData.get("orderId") ?? "");
  const method = String(formData.get("method") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!orderId) return { error: "No order given." };
  if (!isDispatchMethod(method)) return { error: "Choose how it is going out." };

  const supabase = await createServerSupabase();

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, status, product_code, notes, payments(status), order_units(id, tag_id)")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found." };
  if (!isOrderStatus(order.status)) return { error: "Order is in an unknown stage." };

  const isPaid = ((order.payments ?? []) as { status: string }[]).some(
    (p) => p.status === "paid",
  );
  const units = (order.order_units ?? []) as { id: string; tag_id: string | null }[];
  const binding = { total: units.length, bound: units.filter((u) => u.tag_id).length };

  const blocked = transitionBlockedReason(
    pathForProduct(order.product_code),
    order.status,
    "dispatched",
    isPaid,
    binding,
  );
  if (blocked) return { error: `${order.number}: ${blocked}` };

  // The facts first. `record_dispatch` is staff-gated in SQL and refuses any
  // method outside the three, so the check above produces the good error message
  // and the function is what actually enforces it.
  const { error: dispatchError } = await supabase.rpc("record_dispatch", {
    p_order_id: orderId,
    p_method: method,
    p_reference: reference,
  });
  if (dispatchError) return { error: "Could not record the dispatch. Try again." };

  const { error } = await supabase.from("orders").update({ status: "dispatched" }).eq("id", orderId);
  if (error) return { error: error.message };

  // Appended rather than replacing: the note field is where the reason for a
  // delay or an odd request already lives, and overwriting somebody's note to
  // record a rider's name would lose more than it saved.
  if (note) {
    const stamped = `${new Date().toISOString().slice(0, 10)} dispatch: ${note}`;
    await supabase
      .from("orders")
      .update({ notes: order.notes ? `${order.notes}
${stamped}` : stamped })
      .eq("id", orderId);
  }

  // After the response, never before it. The parcel is already out and the row
  // already says so; a slow or failing Resend call must not leave the staff
  // member staring at a spinner or an error about an email.
  after(async () => {
    await notifyDispatched(orderId);
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/board");
  revalidatePath("/admin");
  revalidatePath("/dashboard/orders");

  // Does NOT claim the customer has been emailed. The send has not been attempted
  // yet when this returns, and the outcome lands in `notification_deliveries`
  // afterwards — "sent" there means Resend accepted it and nothing more (§15).
  return { success: `${order.number} is on its way.` };
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

/**
 * Scan a physical card onto one unit of an order (D-026).
 *
 * Three things can arrive in `scanned` and all three are legitimate: a URL from
 * the camera reading the QR on the back of a card, a bare token from an NDEF
 * read, or a serial typed by hand when the camera will not focus. `parseScan`
 * decides which; this decides what it points at.
 *
 * Every refusal that matters — not in stock, wrong variant, already on somebody
 * else's order, order not paid — lives inside `bind_order_unit`, which holds
 * both rows FOR UPDATE and checks the account's live-identity count is the same
 * afterwards as before. Doing any of that here would mean two staff scanning at
 * once could both pass the check and both take the card.
 */
export async function assignCardAction(
  _prev: OpsResult,
  formData: FormData,
): Promise<OpsResult> {
  await requireStaff();

  const unitId = String(formData.get("unitId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const scanned = String(formData.get("scanned") ?? "");
  if (!unitId || !orderId) return { error: "No unit given." };

  const parsed = parseScan(scanned);
  if (parsed.kind === "unknown") {
    return {
      error: "That does not look like a card. Scan the QR on the back, tap the chip, or type the serial.",
    };
  }

  // Stock cards belong to nobody, so they are invisible to an account-scoped
  // read. The staff SELECT policy (0021) is what makes this lookup possible at
  // all; the service role is not used, so a non-staff caller finds nothing.
  const supabase = await createServerSupabase();
  const lookup =
    parsed.kind === "token"
      ? supabase.from("nfc_tags").select("id, serial").eq("token", parsed.token)
      : supabase.from("nfc_tags").select("id, serial").eq("serial", parsed.serial);

  const { data: found } = await lookup.maybeSingle();
  if (!found) {
    return {
      error:
        parsed.kind === "serial"
          ? `No card with serial ${parsed.serial}. Check the digits.`
          : "That card is not in the system. It may be from a batch that was never received.",
    };
  }

  const { error } = await supabase.rpc("bind_order_unit", {
    p_unit_id: unitId,
    p_card_tag_id: found.id,
  });
  if (error) return { error: humanisePostgresError(error.message) };

  await maybeReadyForDispatch(orderId);

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/board");
  revalidatePath("/admin/stock");

  return { success: `${found.serial ?? "Card"} assigned.` };
}

/** Undo a scan, until the parcel has gone out. */
export async function unassignCardAction(
  _prev: OpsResult,
  formData: FormData,
): Promise<OpsResult> {
  await requireStaff();

  const unitId = String(formData.get("unitId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  if (!unitId || !orderId) return { error: "No unit given." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("unbind_order_unit", { p_unit_id: unitId });
  if (error) return { error: humanisePostgresError(error.message) };

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/board");
  revalidatePath("/admin/stock");

  return { success: "Card returned to stock." };
}

/**
 * The last scan on a stock order packs it.
 *
 * In TypeScript rather than inside `bind_order_unit`, because which moves are
 * legal is `lib/orders.ts`'s job and it is tested there. A second copy of the
 * rule in SQL would drift from the first, which is the reasoning D-020 used to
 * keep stuck-detection out of `ops_overview`.
 *
 * Silent on failure by design: the cards are assigned either way, and a staff
 * member who sees "assigned" and then an error about a status they did not ask
 * to change learns nothing useful. The move is offered as a button regardless.
 */
async function maybeReadyForDispatch(orderId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("orders")
    .select("status, product_code, payments(status), order_units(tag_id)")
    .eq("id", orderId)
    .single();
  if (!data || !isOrderStatus(data.status)) return;

  const path = pathForProduct(data.product_code);
  if (path !== "stock") return;

  const units = (data.order_units ?? []) as { tag_id: string | null }[];
  const binding = { total: units.length, bound: units.filter((u) => u.tag_id).length };
  const isPaid = ((data.payments ?? []) as { status: string }[]).some((p) => p.status === "paid");

  if (transitionBlockedReason(path, data.status, "ready_for_dispatch", isPaid, binding)) return;

  await supabase.from("orders").update({ status: "ready_for_dispatch" }).eq("id", orderId);
}

/**
 * Postgres exceptions reach the client as raw strings. The ones `bind_order_unit`
 * raises are already written for a person, so they pass through; anything else
 * is an internal failure and should not be shown as though it were advice.
 */
function humanisePostgresError(message: string): string {
  const known = [
    "not in stock",
    "already on order",
    "marked defective",
    "is not paid",
    "already has a card",
    "needs a",
    "placeholder",
    "stand, not a card",
    "card not found",
    "unit not found",
    "already gone out",
    "is cancelled",
    "no identity to move",
    "nothing to undo",
  ];
  const lower = message.toLowerCase();
  if (known.some((k) => lower.includes(k))) {
    return message.charAt(0).toUpperCase() + message.slice(1);
  }
  if (lower.includes("staff only")) return "Staff only.";
  return "That did not work. Try again, or check the card in Stock.";
}
