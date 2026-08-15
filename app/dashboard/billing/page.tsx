import { createServerSupabase } from "@/lib/supabase/server";
import {
  effectivePlan,
  purchasedPlan,
  subscriptionState,
  type SubscriptionRow,
} from "@/lib/plans";
import { PageHeader } from "@/components/shell/page-header";
import { PlanStatus } from "@/components/billing/plan-status";
import { PaymentHistory } from "@/components/billing/payment-history";
import type { PaymentRow } from "@/lib/payments";
import BillingPlans from "./billing-plans";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createServerSupabase();

  const [{ data: sub }, { data: paymentsData }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan_code, status, current_period_end")
      .maybeSingle(),
    // RLS limits this to the caller's own account (payments_select_own, 0004).
    supabase
      .from("payments")
      .select("id, plan_code, provider, reference, amount, currency, status, created_at, raw")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const subscription = (sub ?? null) as SubscriptionRow | null;
  const state = subscriptionState(subscription);
  const effective = effectivePlan(subscription);
  const purchased = purchasedPlan(subscription);
  const payments = (paymentsData ?? []) as PaymentRow[];

  return (
    <>
      <PageHeader
        title="Billing"
        description="Your plan, payments and receipts."
      />

      <div className="flex max-w-3xl flex-col gap-4">
        <PlanStatus
          state={state}
          purchased={purchased}
          effective={effective}
          subscription={subscription}
        />

        <section id="plans" className="scroll-mt-20">
          <h2 className="mb-3 text-section-title text-foreground">
            {state === "expired" ? "Renew or change plan" : "Plans"}
          </h2>
          <BillingPlans currentPlan={effective.code} />
        </section>

        <PaymentHistory payments={payments} />

        <p className="text-caption text-muted">
          Paid annually via M-Pesa. You&rsquo;ll get an STK prompt on your phone to enter your
          PIN; your plan activates once Safaricom confirms the payment.
        </p>
      </div>
    </>
  );
}
