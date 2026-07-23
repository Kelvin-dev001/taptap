import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
import BillingPlans from "./billing-plans";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_code, status, current_period_end")
    .maybeSingle();

  const current = planFor(sub?.plan_code);
  const renews = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Dashboard
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Billing</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Current plan:{" "}
        <span className="font-medium text-neutral-900">{current.name}</span>
        {current.code !== "free" && sub?.status ? ` (${sub.status})` : ""}
        {renews ? ` · renews ${renews}` : ""}
      </p>

      <BillingPlans currentPlan={current.code} />

      <p className="mt-6 text-xs text-neutral-500">
        Annual plans, paid via M-Pesa. You’ll get an STK prompt on your phone to
        enter your PIN; your plan activates once payment is confirmed.
      </p>
    </main>
  );
}
