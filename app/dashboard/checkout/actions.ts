"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hardwareAmountKes, type DeviceKind } from "@/lib/pricing";
import { PRODUCT_KIND } from "@/lib/orders";
import { stkPush, stkQuery, normalizePhone, describeStkFailure } from "@/lib/mpesa";
import {
  settlePayment,
  failPayment,
  SETTLEABLE_PAYMENT_COLUMNS,
  type SettleablePayment,
} from "@/lib/provisioning";
import { mpesaReceiptNumber } from "@/lib/payments";

/** Ordering more than this in one go is a conversation, not a self-serve checkout. */
const MAX_QUANTITY = 20;

export type StartCheckoutResult = {
  error?: string;
  order?: {
    id: string;
    number: string;
    amountKes: number;
    /** The Daraja CheckoutRequestID. What the status poll asks about. */
    reference: string;
  };
};

/**
 * Buy hardware (D-019), and tell the caller enough to follow the payment.
 *
 * The order is created BEFORE the STK push and the payment row after it. That
 * ordering is deliberate: if the push fails we are left with an unpaid order —
 * a legitimate state ops can see and chase — rather than a customer being
 * charged for something we never recorded.
 *
 * What changed in Sprint 7 is only the return value. This used to hand back a
 * sentence ("check your phone"), which is where the flow ended; it now returns
 * the reference so the UI can poll and resolve itself.
 *
 * We ask for as little as possible before taking money: product, quantity and
 * the number to prompt. Delivery name and artwork are collected after it clears.
 */
export async function startCheckoutAction(
  _prev: StartCheckoutResult,
  formData: FormData,
): Promise<StartCheckoutResult> {
  const productCode = String(formData.get("product") ?? "");
  const quantityRaw = parseInt(String(formData.get("quantity") ?? "1"), 10);
  const phoneRaw = String(formData.get("phone") ?? "");

  const kind: DeviceKind | undefined = PRODUCT_KIND[productCode];
  if (!kind) return { error: "Choose a product." };

  const quantity = Number.isFinite(quantityRaw) ? quantityRaw : 0;
  if (quantity < 1) return { error: "Order at least one." };
  if (quantity > MAX_QUANTITY) {
    return {
      error: `For more than ${MAX_QUANTITY}, ask us for a quote and we will sort it out with you.`,
    };
  }

  const phone = normalizePhone(phoneRaw);
  if (!phone) return { error: "Enter a valid Safaricom number (e.g. 0712345678)." };

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

  // Priced server-side from lib/pricing.ts, never from the form. A posted amount
  // would let a client name its own price.
  const amount = hardwareAmountKes(kind, quantity);
  if (amount <= 0) return { error: "Could not price that order." };

  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      account_id: profile.account_id,
      product_code: productCode,
      quantity,
      amount_kes: amount,
      contact_phone: phone,
    })
    .select("id, number")
    .single();

  if (orderError || !order) {
    return { error: "Could not create the order. Nothing has been charged." };
  }

  const pushed = await pushForOrder(admin, {
    accountId: profile.account_id,
    orderId: order.id,
    orderNumber: order.number,
    amount,
    quantity,
    phone,
  });

  if (pushed.error) {
    // Without a payment row the callback cannot match this checkout, so the
    // order would sit unpaid forever. Cancelling it says so plainly instead.
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return { error: pushed.error };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/billing");

  return {
    order: {
      id: order.id,
      number: order.number,
      amountKes: amount,
      reference: pushed.reference as string,
    },
  };
}

/**
 * Send the prompt again for an order that already exists.
 *
 * A new `payments` row with a new reference, against the same order. Safe to do
 * repeatedly: `payment_tags` means a second payment that somehow also succeeds
 * provisions nothing extra, and `provisionForOrder` returns early when the order
 * already has identities. What must never happen is a second ORDER for the same
 * intent, which is why resuming is offered before buying.
 */
export async function resendPromptAction(
  orderId: string,
  phoneRaw?: string,
): Promise<StartCheckoutResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS-scoped (orders_select_own, 0017): another account's order reads as
  // missing rather than as forbidden.
  const { data: order } = await supabase
    .from("orders")
    .select("id, number, account_id, quantity, amount_kes, status, contact_phone, payments(status)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { error: "Order not found." };
  if (order.status === "cancelled") {
    return { error: "That order was cancelled. Start a new one." };
  }

  const alreadyPaid = ((order.payments ?? []) as { status: string }[]).some(
    (p) => p.status === "paid",
  );
  if (alreadyPaid) {
    return { error: "That order is already paid for." };
  }

  const phone = normalizePhone(phoneRaw || order.contact_phone || "");
  if (!phone) return { error: "Enter a valid Safaricom number (e.g. 0712345678)." };

  const admin = createAdminClient();
  const pushed = await pushForOrder(admin, {
    accountId: order.account_id,
    orderId: order.id,
    orderNumber: order.number,
    amount: order.amount_kes,
    quantity: order.quantity,
    phone,
  });

  if (pushed.error) return { error: pushed.error };

  return {
    order: {
      id: order.id,
      number: order.number,
      amountKes: order.amount_kes,
      reference: pushed.reference as string,
    },
  };
}

type Admin = ReturnType<typeof createAdminClient>;

/** The STK push and its payment row. One place, so both callers record identically. */
async function pushForOrder(
  admin: Admin,
  opts: {
    accountId: string;
    orderId: string;
    orderNumber: string;
    amount: number;
    quantity: number;
    phone: string;
  },
): Promise<{ reference?: string; error?: string }> {
  try {
    const { checkoutRequestId, raw } = await stkPush({
      phone: opts.phone,
      amount: opts.amount,
      accountRef: opts.orderNumber,
      description: `Order ${opts.orderNumber}`,
    });

    const { error } = await admin.from("payments").insert({
      account_id: opts.accountId,
      provider: "mpesa",
      reference: checkoutRequestId,
      amount: opts.amount,
      status: "pending",
      kind: "hardware",
      quantity: opts.quantity,
      order_id: opts.orderId,
      raw,
    });

    if (error) {
      return { error: "Could not record the payment. Nothing has been charged." };
    }
    return { reference: checkoutRequestId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start payment." };
  }
}

export type PaymentStatusResult = {
  status: "pending" | "paid" | "failed";
  /** M-Pesa receipt code, once there is one. */
  receipt?: string | null;
  /** Why it failed, in words the customer can act on. */
  reason?: string | null;
  error?: string;
};

/**
 * Ask what happened to a payment.
 *
 * Our own row first: when Safaricom's callback has already landed this resolves
 * without touching Daraja at all, which is both faster and one fewer thing to
 * rate limit. Daraja is asked only while we genuinely do not know.
 *
 * When Daraja gives a verdict the payment is settled HERE, through the same
 * `settlePayment` the callback uses. That is the point of the poll: a callback
 * lost on the network must not leave a paid customer unprovisioned.
 */
export async function checkPaymentStatusAction(
  reference: string,
): Promise<PaymentStatusResult> {
  if (!reference) return { status: "pending", error: "No payment to check." };

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "pending", error: "Not signed in." };

  // Ownership comes from RLS (payments_select_own, 0004) rather than from a
  // check written here: a reference belonging to another account simply does not
  // exist as far as this read is concerned.
  const { data: own } = await supabase
    .from("payments")
    .select("id, status, raw")
    .eq("reference", reference)
    .maybeSingle();

  if (!own) return { status: "pending", error: "Payment not found." };

  if (own.status === "paid") {
    return { status: "paid", receipt: mpesaReceiptNumber(own.raw) };
  }
  if (own.status === "failed") {
    return { status: "failed", reason: null };
  }

  // Still pending as far as we know. Ask Safaricom.
  let outcome;
  try {
    outcome = await stkQuery(reference);
  } catch {
    // A configuration or transport failure is not a payment failure. Stay
    // pending and let the caller keep waiting or time out.
    return { status: "pending" };
  }

  if (outcome.state === "unknown") return { status: "pending" };

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select(SETTLEABLE_PAYMENT_COLUMNS)
    .eq("reference", reference)
    .single();
  if (!payment) return { status: "pending" };

  if (outcome.state === "paid") {
    await settlePayment(admin, payment as SettleablePayment, outcome.raw);
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard");
    // The receipt number lives in the CALLBACK payload, not the query response,
    // so it may genuinely not exist yet. The success screen re-reads it.
    return { status: "paid", receipt: null };
  }

  await failPayment(admin, payment.id, outcome.raw);
  return {
    status: "failed",
    reason: outcome.description || describeStkFailure(outcome.resultCode),
  };
}

export type ManualPaymentResult = { error?: string; reference?: string };

/**
 * Record that the customer is paying by Paybill instead.
 *
 * Creates a pending payment row flagged for staff rather than leaving the
 * intention in a WhatsApp message. The order then appears in ops as awaiting
 * reconciliation, and staff settle it with "record offline payment" — which runs
 * the same provisioning path as a callback, so a Paybill customer ends up with
 * exactly what an STK customer does.
 *
 * Deliberately does NOT provision anything. Nobody has paid yet.
 */
export async function requestManualPaymentAction(
  orderId: string,
): Promise<ManualPaymentResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, account_id, amount_kes, quantity, status, payments(status, provider)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Order not found." };

  const payments = (order.payments ?? []) as { status: string; provider: string }[];
  if (payments.some((p) => p.status === "paid")) {
    return { error: "That order is already paid for." };
  }

  // One standing request per order is enough; a second would just be noise on
  // the ops queue for the same money.
  const existing = payments.find(
    (p) => p.provider === "mpesa_manual" && p.status === "pending",
  );
  if (existing) return { reference: order.number };

  const admin = createAdminClient();
  const { error } = await admin.from("payments").insert({
    account_id: order.account_id,
    provider: "mpesa_manual",
    // `payments.reference` is UNIQUE and is normally Daraja's checkout id. A
    // manual payment has none, so it carries the order number it is for, which
    // is also the reference the customer types into M-Pesa.
    reference: `manual:${order.number}`,
    amount: order.amount_kes,
    status: "pending",
    kind: "hardware",
    quantity: order.quantity,
    order_id: order.id,
  });

  if (error) return { error: "Could not record that. Talk to us on WhatsApp instead." };

  revalidatePath("/dashboard/orders");
  return { reference: order.number };
}
