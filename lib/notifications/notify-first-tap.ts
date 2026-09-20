import { createAdminClient } from "@/lib/supabase/admin";
import { composeFirstTapEmail } from "./first-tap-email";
import { sendEmail } from "./send";

/** Shape returned by the first_tap_notification_target RPC (migration 0028). */
type Target = {
  accountId: string;
  businessName: string;
  orderNumber: string;
  quantity: number;
  productName: string;
  slug: string | null;
  ownerEmail: string | null;
};

export type NotifyOutcome =
  | { status: "sent"; to: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Tell the owner their card went live.
 *
 * Never throws, and never runs before the redirect. This is called from inside
 * `after()` on the tap path, which is the hottest path in the product: somebody
 * is standing in front of a customer holding a phone against a card, and an
 * email provider having a slow afternoon must not be something they can feel.
 *
 * Idempotent on (kind, ref_id, channel) exactly as `notifyNewLead` and
 * `notifyDispatched` are. Belt and braces with `record_first_tap`, which already
 * only fires once: two taps in the same second would otherwise race between the
 * RPC returning and this claiming the send.
 */
export async function notifyFirstTap(orderId: string): Promise<NotifyOutcome> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("first_tap_notification_target", {
      p_order_id: orderId,
    });
    if (error) return { status: "failed", error: error.message };

    const target = data as Target | null;
    if (!target || !target.orderNumber) return { status: "skipped", reason: "order not found" };
    if (!target.ownerEmail) return { status: "skipped", reason: "no recipient address" };

    // Claim the send BEFORE performing it. The unique constraint on
    // (kind, ref_id, channel) is what makes this safe: if two taps race, exactly
    // one insert succeeds and the loser stops here rather than sending twice.
    const { error: claimError } = await admin.from("notification_deliveries").insert({
      account_id: target.accountId,
      kind: "first_tap",
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
    const composed = composeFirstTapEmail({
      businessName: target.businessName,
      orderNumber: target.orderNumber,
      quantity: target.quantity,
      productName: target.productName,
      slug: target.slug,
      siteUrl,
    });

    const result = await sendEmail({ to: target.ownerEmail, ...composed });

    // "sent" means Resend accepted it, not that anyone read it (§15).
    await admin
      .from("notification_deliveries")
      .update(
        result.ok
          ? { status: "sent", provider_id: result.providerId, error: null }
          : { status: "failed", error: result.error },
      )
      .eq("kind", "first_tap")
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

/**
 * The first tap, end to end: record it, close the order, tell the owner.
 *
 * One entry point so the tap route has a single thing to call and no logic of
 * its own. `record_first_tap` is service-role only and decides whether anything
 * happened at all; if it did not, this returns without touching the notifier.
 */
export async function handleFirstTap(tagId: string): Promise<NotifyOutcome> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("record_first_tap", { p_tag_id: tagId });
    if (error) return { status: "failed", error: error.message };

    const result = data as
      | { first_tap?: boolean; order_closed?: boolean; order_id?: string }
      | null;

    // Not the first tap, not an allocated card, or no order behind it. All
    // ordinary: most taps are the hundredth, not the first.
    if (!result?.first_tap || !result.order_id) {
      return { status: "skipped", reason: "not a first tap" };
    }

    // Only announce a card that actually arrived. A first tap on an order still
    // sitting at `ready_for_dispatch` is staff testing it in the workshop, and
    // emailing the customer "you are live" about a parcel still on the bench is
    // worse than saying nothing.
    if (!result.order_closed) {
      return { status: "skipped", reason: "order was not out for delivery" };
    }

    return await notifyFirstTap(result.order_id);
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "first tap failed",
    };
  }
}
