"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBillingContext } from "@/lib/billing-context";
import { renewalAmountKes, billableIdentities } from "@/lib/identity";
import { formatKes } from "@/lib/pricing";
import { stkPush, normalizePhone } from "@/lib/mpesa";

export type CheckoutResult = { error?: string; success?: string };

/**
 * Start a consolidated renewal (D-018).
 *
 * Terms are stored per identity so that the twelve months bundled with a device
 * are the twelve months actually delivered. "Consolidated" is therefore a
 * billing *action* — one M-Pesa prompt covering every device the owner selected
 * — rather than a shared date that would have to shorten one device's term to
 * align it with another's.
 */
export async function startRenewalAction(
  _prev: CheckoutResult,
  formData: FormData,
): Promise<CheckoutResult> {
  const phoneRaw = String(formData.get("phone") ?? "");
  const requested = formData
    .getAll("tag")
    .map((v) => String(v))
    .filter(Boolean);

  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return { error: "Enter a valid Safaricom number (e.g. 0712345678)." };
  }
  if (requested.length === 0) {
    return { error: "Select at least one device to renew." };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No account found." };

  // Never trust the posted ids. The set actually charged is the intersection of
  // what was asked for with what this account genuinely owns and can be billed
  // for — so a tampered form cannot renew (or pay for) someone else's device.
  const { identities, migrationPending } = await loadBillingContext(
    supabase,
    profile.account_id,
  );
  if (migrationPending) {
    return { error: "Billing is being updated. Try again shortly." };
  }

  // Anything billable, not only what is imminently due — an owner is allowed to
  // pay early, and renewing early adds a year rather than resetting the term.
  const billableIds = new Set(billableIdentities(identities).map((t) => t.id));
  const tagIds = requested.filter((id) => billableIds.has(id));
  if (tagIds.length === 0) {
    return { error: "Those devices are not available to renew." };
  }

  const amount = renewalAmountKes(tagIds.length);
  if (amount <= 0) return { error: "Nothing to renew." };

  try {
    const { checkoutRequestId, raw } = await stkPush({
      phone,
      amount,
      accountRef: "TapTap",
      description: `Renew ${tagIds.length}`,
    });

    // Recorded server-side (service role) keyed by the checkout id, together
    // with the exact devices it covers. That link is what makes the callback
    // replay-safe: a repeated callback extends the same set, never a new one.
    const admin = createAdminClient();
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        account_id: profile.account_id,
        provider: "mpesa",
        reference: checkoutRequestId,
        amount,
        status: "pending",
        kind: "renewal",
        quantity: tagIds.length,
        raw,
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      return { error: "Could not record the payment. Nothing has been charged." };
    }

    const { error: linkError } = await admin
      .from("payment_tags")
      .insert(tagIds.map((tagId) => ({ payment_id: payment.id, tag_id: tagId })));

    if (linkError) {
      // Without the links the callback cannot know what to extend, so the
      // payment is failed immediately rather than left to confirm into nothing.
      await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return { error: "Could not record the payment. Nothing has been charged." };
    }

    return {
      success: `Check your phone and enter your M-Pesa PIN to pay ${formatKes(amount)}. Your ${
        tagIds.length === 1 ? "device renews" : "devices renew"
      } once Safaricom confirms.`,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not start payment.",
    };
  }
}
