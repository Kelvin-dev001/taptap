import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadBillingContext } from "@/lib/billing-context";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { BillingOverview } from "@/components/billing/billing-overview";
import { BuyDevice } from "@/components/billing/buy-device";
import { IdentityList } from "@/components/billing/identity-list";
import { PaymentHistory } from "@/components/billing/payment-history";
import type { PaymentRow } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();

  const [billing, { data: paymentsData }] = await Promise.all([
    loadBillingContext(supabase, profile?.account_id),
    // RLS limits this to the caller's own account (payments_select_own, 0004).
    supabase
      .from("payments")
      .select(
        "id, plan_code, kind, quantity, provider, reference, amount, currency, status, created_at, raw",
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const payments = (paymentsData ?? []) as PaymentRow[];

  return (
    <>
      <PageHeader title="Billing" description="Your devices, renewals and receipts." />

      <div className="flex max-w-3xl flex-col gap-4">
        {billing.migrationPending && (
          <MigrationNotice migration="0015_per_identity_billing.sql" />
        )}

        <BillingOverview summary={billing.summary} />

        <BuyDevice />

        <IdentityList
          identities={billing.identities}
          dueIds={billing.summary.due.map((t) => t.id)}
        />

        <PaymentHistory payments={payments} />

        <p className="text-caption text-muted">
          <Link href="/dashboard/orders" className="underline">
            Track your orders
          </Link>{" "}
          from payment through to delivery.
        </p>

        <p className="text-caption text-muted">
          Paid by M-Pesa. You&rsquo;ll get an STK prompt on your phone to enter your PIN;
          devices renew once Safaricom confirms the payment.
        </p>
      </div>
    </>
  );
}
