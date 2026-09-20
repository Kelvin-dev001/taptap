import { createAdminClient } from "@/lib/supabase/admin";
import { isDispatchMethod } from "@/lib/orders";
import { composeDispatchEmail } from "./dispatch-email";
import { sendEmail } from "./send";

/** Shape returned by the dispatch_notification_target RPC (migration 0026). */
type Target = {
  accountId: string;
  businessName: string;
  orderNumber: string;
  quantity: number;
  productName: string;
  method: string | null;
  reference: string | null;
  destination: string | null;
  ownerEmail: string | null;
};

export type NotifyOutcome =
  | { status: "sent"; to: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Tell the customer their parcel has left, and who has it.
 *
 * Never throws. Called after the dispatch has already been recorded, so there is
 * nothing left to undo and nobody to show an error to: a failure belongs in
 * `notification_deliveries`, not in the face of the staff member who just handed
 * a parcel to a rider.
 *
 * Idempotent on (kind, ref_id, channel) exactly as `notifyNewLead` is, which is
 * what makes it safe for staff to correct a waybill and for the action to call
 * this again: the second call is a skip, not a second email. That does mean a
 * corrected reference is not re-sent, which is the right way round. One email
 * with a wrong digit prompts a phone call; two emails with different numbers
 * prompt a complaint.
 */
export async function notifyDispatched(orderId: string): Promise<NotifyOutcome> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("dispatch_notification_target", {
      p_order_id: orderId,
    });
    if (error) return { status: "failed", error: error.message };

    const target = data as Target | null;
    // The RPC returns nothing for an order that has not been dispatched, so this
    // covers both "no such order" and "not gone out yet".
    if (!target || !target.orderNumber) {
      return { status: "skipped", reason: "order not dispatched" };
    }
    if (!target.ownerEmail) return { status: "skipped", reason: "no recipient address" };
    if (!isDispatchMethod(target.method)) {
      return { status: "skipped", reason: "no dispatch method recorded" };
    }

    // Claim the send BEFORE performing it. The unique constraint on
    // (kind, ref_id, channel) is what makes this safe: if the action is retried,
    // or two staff mark the same order dispatched at once, exactly one insert
    // succeeds and the loser stops here rather than sending a duplicate.
    const { error: claimError } = await admin.from("notification_deliveries").insert({
      account_id: target.accountId,
      kind: "dispatched",
      ref_id: orderId,
      channel: "email",
      status: "failed",
      error: "in flight",
    });
    if (claimError) {
      // 23505 = unique_violation: this order has already been announced.
      if (claimError.code === "23505") return { status: "skipped", reason: "already notified" };
      return { status: "failed", error: claimError.message };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://taptap.hornbilltech.co.ke";
    const composed = composeDispatchEmail({
      businessName: target.businessName,
      orderNumber: target.orderNumber,
      quantity: target.quantity,
      productName: target.productName,
      method: target.method,
      reference: target.reference,
      destination: target.destination,
      siteUrl,
    });

    const result = await sendEmail({ to: target.ownerEmail, ...composed });

    // Record what the provider actually said. "sent" means Resend accepted it,
    // not that anyone read it and not that it cleared a spam filter (§15).
    await admin
      .from("notification_deliveries")
      .update(
        result.ok
          ? { status: "sent", provider_id: result.providerId, error: null }
          : { status: "failed", error: result.error },
      )
      .eq("kind", "dispatched")
      .eq("ref_id", orderId)
      .eq("channel", "email");

    return result.ok
      ? { status: "sent", to: target.ownerEmail }
      : { status: "failed", error: result.error };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "notification failed",
    };
  }
}
