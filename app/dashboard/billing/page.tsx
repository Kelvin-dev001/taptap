import { createServerSupabase } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
import { Badge } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import BillingPlans from "./billing-plans";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createServerSupabase();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_code, status, current_period_end")
    .maybeSingle();

  const current = planFor(sub?.plan_code);
  const renews = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null;

  return (
    <>
      <PageHeader
        title="Billing"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              Current plan{" "}
              <span className="font-medium text-foreground">{current.name}</span>
            </span>
            {current.code !== "free" && sub?.status && (
              <Badge variant={sub.status === "active" ? "success" : "warning"} dot>
                {sub.status}
              </Badge>
            )}
            {renews && <span>· renews {renews}</span>}
          </span>
        }
      />

      <div className="max-w-2xl">
        <BillingPlans currentPlan={current.code} />

        <p className="mt-6 text-caption text-muted">
          Annual plans, paid via M-Pesa. You&rsquo;ll get an STK prompt on your phone to enter
          your PIN; your plan activates once payment is confirmed.
        </p>
      </div>
    </>
  );
}
