"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PLANS, PLAN_ORDER, type PlanCode } from "@/lib/plans";
import { startCheckoutAction, type CheckoutResult } from "./actions";

const initial: CheckoutResult = {};

function PayButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Starting…" : "Subscribe"}
    </button>
  );
}

export default function BillingPlans({
  currentPlan,
}: {
  currentPlan: PlanCode;
}) {
  const [state, action] = useActionState(startCheckoutAction, initial);

  return (
    <div className="flex flex-col gap-4">
      {PLAN_ORDER.map((code) => {
        const plan = PLANS[code];
        const isCurrent = code === currentPlan;
        return (
          <div key={code} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="text-sm text-neutral-500">
                  {plan.priceKesAnnual === 0
                    ? "Free"
                    : `KES ${plan.priceKesAnnual.toLocaleString()}/yr`}
                </p>
              </div>
              {isCurrent && (
                <span className="text-xs font-medium text-green-600">
                  current plan
                </span>
              )}
            </div>
            <ul className="mt-2 list-inside list-disc text-sm text-neutral-600">
              <li>
                {plan.limits.maxProfiles < 0
                  ? "Unlimited"
                  : plan.limits.maxProfiles}{" "}
                link(s)
              </li>
              {plan.limits.customBranding && <li>Custom branding</li>}
              {plan.limits.leadCapture && <li>Lead capture</li>}
              {plan.limits.advancedAnalytics && <li>Advanced analytics</li>}
            </ul>
            {code !== "free" && !isCurrent && (
              <form action={action} className="mt-3 flex gap-2">
                <input type="hidden" name="plan" value={code} />
                <input
                  name="phone"
                  required
                  placeholder="M-Pesa no. e.g. 0712345678"
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <PayButton />
              </form>
            )}
          </div>
        );
      })}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </div>
  );
}
