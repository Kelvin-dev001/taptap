"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { transitionBlockedReason, isOrderStatus, ORDER_STATUS_META } from "@/lib/orders";

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
