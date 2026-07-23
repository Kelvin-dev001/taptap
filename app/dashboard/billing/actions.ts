"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planFor } from "@/lib/plans";
import { stkPush, normalizePhone } from "@/lib/mpesa";

export type CheckoutResult = { error?: string; success?: string };

export async function startCheckoutAction(
  _prev: CheckoutResult,
  formData: FormData,
): Promise<CheckoutResult> {
  const planCode = String(formData.get("plan") ?? "");
  const phoneRaw = String(formData.get("phone") ?? "");

  const plan = planFor(planCode);
  if (plan.code === "free") return { error: "Choose a paid plan." };

  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return { error: "Enter a valid Safaricom number (e.g. 0712345678)." };
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

  try {
    const { checkoutRequestId, raw } = await stkPush({
      phone,
      amount: plan.priceKesAnnual,
      accountRef: "TapTap",
      description: `${plan.name} plan`,
    });

    // Record the pending payment server-side (service role) keyed by the checkout id.
    const admin = createAdminClient();
    await admin.from("payments").insert({
      account_id: profile.account_id,
      plan_code: plan.code,
      provider: "mpesa",
      reference: checkoutRequestId,
      amount: plan.priceKesAnnual,
      status: "pending",
      raw,
    });

    return {
      success:
        "Check your phone and enter your M-Pesa PIN to complete payment. Your plan activates once confirmed.",
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not start payment.",
    };
  }
}
