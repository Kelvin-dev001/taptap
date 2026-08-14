"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { PLANS, PLAN_ORDER, type PlanCode } from "@/lib/plans";
import { Card, Badge, Button, Field, Input, Alert } from "@/components/ui";
import { startCheckoutAction, type CheckoutResult } from "./actions";

const initial: CheckoutResult = {};

function PayButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText="Starting…">
      Subscribe
    </Button>
  );
}

export default function BillingPlans({ currentPlan }: { currentPlan: PlanCode }) {
  const [state, action] = useActionState(startCheckoutAction, initial);

  return (
    <div className="flex flex-col gap-4">
      {PLAN_ORDER.map((code) => {
        const plan = PLANS[code];
        const isCurrent = code === currentPlan;
        const features = [
          plan.limits.maxProfiles < 0
            ? "Unlimited links"
            : `${plan.limits.maxProfiles} link${plan.limits.maxProfiles === 1 ? "" : "s"}`,
          plan.limits.customBranding && "Custom branding",
          plan.limits.leadCapture && "Lead capture",
          plan.limits.advancedAnalytics && "Advanced analytics",
        ].filter(Boolean) as string[];

        return (
          <Card key={code} padding="md" variant={isCurrent ? "elevated" : "default"}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-section-title text-foreground">{plan.name}</h2>
                <p className="text-body-sm text-muted">
                  {plan.priceKesAnnual === 0
                    ? "Free"
                    : `KES ${plan.priceKesAnnual.toLocaleString()} / year`}
                </p>
              </div>
              {isCurrent && (
                <Badge variant="success" dot>
                  Current plan
                </Badge>
              )}
            </div>

            <ul className="mt-3 flex flex-col gap-1.5">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-body-sm text-foreground-secondary">
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>

            {code !== "free" && !isCurrent && (
              <form action={action} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="plan" value={code} />
                <Field label="M-Pesa number" required className="min-w-[12rem] flex-1">
                  <Input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    required
                    placeholder="0712 345 678"
                  />
                </Field>
                <PayButton />
              </form>
            )}
          </Card>
        );
      })}

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
    </div>
  );
}
