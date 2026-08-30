"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hardwareAmountKes, formatKes, type DeviceKind } from "@/lib/pricing";
import { PRODUCT_KIND } from "@/lib/orders";
import { stkPush, normalizePhone } from "@/lib/mpesa";

export type OrderResult = { error?: string; success?: string };

/** Ordering more than this in one go is a conversation, not a self-serve checkout. */
const MAX_QUANTITY = 20;

/**
 * Buy hardware (D-019).
 *
 * The order is created BEFORE the STK push, and the payment row after it. That
 * ordering is deliberate: if the push fails we are left with an unpaid order —
 * a legitimate state that ops can see and chase — rather than a customer being
 * charged for something we never recorded.
 *
 * Fulfilment status and payment status are separate machines (D-019). A fresh
 * order sits at `new` regardless of payment; whether it has been paid for is a
 * fact about its payment row, and the views join the two.
 */
export async function startOrderAction(
  _prev: OrderResult,
  formData: FormData,
): Promise<OrderResult> {
  const productCode = String(formData.get("product") ?? "");
  const quantityRaw = parseInt(String(formData.get("quantity") ?? "1"), 10);
  const phoneRaw = String(formData.get("phone") ?? "");
  const contactName = String(formData.get("contactName") ?? "").trim() || null;

  const kind: DeviceKind | undefined = PRODUCT_KIND[productCode];
  if (!kind) return { error: "Choose a product." };

  const quantity = Number.isFinite(quantityRaw) ? quantityRaw : 0;
  if (quantity < 1) return { error: "Order at least one." };
  if (quantity > MAX_QUANTITY) {
    return { error: `For more than ${MAX_QUANTITY}, talk to us and we will quote you.` };
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
      contact_name: contactName,
      contact_phone: phone,
    })
    .select("id, number")
    .single();

  if (orderError || !order) {
    return { error: "Could not create the order. Nothing has been charged." };
  }

  try {
    const { checkoutRequestId, raw } = await stkPush({
      phone,
      amount,
      accountRef: order.number,
      description: `Order ${order.number}`,
    });

    const { error: paymentError } = await admin.from("payments").insert({
      account_id: profile.account_id,
      provider: "mpesa",
      reference: checkoutRequestId,
      amount,
      status: "pending",
      kind: "hardware",
      quantity,
      order_id: order.id,
      raw,
    });

    if (paymentError) {
      // Without the payment row the callback cannot match this checkout, so the
      // order would sit unpaid forever. Cancelling it says so plainly instead.
      await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      return { error: "Could not record the payment. Nothing has been charged." };
    }

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/billing");

    return {
      success: `Order ${order.number} created. Check your phone and enter your M-Pesa PIN to pay ${formatKes(
        amount,
      )}.`,
    };
  } catch (e) {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return {
      error: e instanceof Error ? e.message : "Could not start payment.",
    };
  }
}
