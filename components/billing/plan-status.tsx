import Link from "next/link";
import { CircleAlert, TriangleAlert, CircleCheck, Info } from "lucide-react";
import { Card, Badge, Alert, buttonVariants } from "@/components/ui";
import {
  daysUntil,
  formatKes,
  type Plan,
  type SubscriptionRow,
  type SubscriptionState,
} from "@/lib/plans";
import { cn } from "@/lib/cn";

/**
 * Current plan and what is actually true about it.
 *
 * Deliberately excludes usage, branches and team members (§21) — the question
 * this card answers is "what am I on, and when does it end".
 */
export function PlanStatus({
  state,
  purchased,
  effective,
  subscription,
}: {
  state: SubscriptionState;
  /** What was bought. */
  purchased: Plan;
  /** What still applies today — these differ once a plan lapses. */
  effective: Plan;
  subscription: SubscriptionRow | null;
}) {
  const remaining = daysUntil(subscription?.current_period_end);
  const endsOn = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label uppercase text-muted">Current plan</p>
          <p className="mt-1 flex items-center gap-2 text-page-title text-foreground">
            {effective.name}
            {state === "active" && (
              <Badge variant="success" dot>
                Active
              </Badge>
            )}
            {state === "expiring" && (
              <Badge variant="warning" dot>
                Ending soon
              </Badge>
            )}
            {state === "expired" && (
              <Badge variant="danger" dot>
                Expired
              </Badge>
            )}
            {state === "inactive" && (
              <Badge variant="warning" dot>
                Payment issue
              </Badge>
            )}
          </p>
          {effective.priceKesAnnual > 0 && (
            <p className="mt-0.5 text-body-sm text-muted">
              {formatKes(effective.priceKesAnnual)} per year
            </p>
          )}
        </div>

        {effective.code !== "business" && (
          <Link href="#plans" className={cn(buttonVariants({ size: "sm" }))}>
            {effective.code === "free" ? "Choose a plan" : "Upgrade"}
          </Link>
        )}
      </div>

      {/* Expiry is stated as a fact with a date, not a vague "renews soon". */}
      {state === "expired" && (
        <Alert tone="danger" title={`Your ${purchased.name} plan ended${endsOn ? ` on ${endsOn}` : ""}`}>
          You are now on the Free plan. Your existing links and cards keep working — but paid
          features are unavailable until you renew.
        </Alert>
      )}

      {state === "expiring" && endsOn && (
        <Alert tone="warning" title={`Your plan ends on ${endsOn}`}>
          {remaining !== null && remaining > 0
            ? `${remaining} day${remaining === 1 ? "" : "s"} left. `
            : ""}
          Renew below to avoid dropping to the Free plan.
        </Alert>
      )}

      {state === "inactive" && (
        <Alert tone="warning" title="There is a problem with your last payment">
          Your subscription is marked “{subscription?.status}”. Try paying again below, or
          contact support if the amount has already left your account.
        </Alert>
      )}

      {state === "active" && endsOn && (
        <div className="flex items-start gap-2 rounded-lg bg-surface-sunken p-3">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-body-sm text-foreground-secondary">
            Paid until <span className="font-medium text-foreground">{endsOn}</span>.
          </p>
        </div>
      )}

      {/* Two facts customers otherwise have to guess at. Both are consequences
          of D-006 (annual-first, M-Pesa Ratiba deferred), and hiding them would
          make an absent Cancel button look like a missing feature. */}
      <ul className="flex flex-col gap-2 border-t border-border pt-4">
        <Fact icon={Info}>
          <strong className="font-medium text-foreground">Nothing renews automatically.</strong>{" "}
          We do not hold a standing M-Pesa mandate, so your plan simply ends on its date unless
          you pay again — there is nothing to cancel.
        </Fact>
        <Fact icon={Info}>
          <strong className="font-medium text-foreground">No card is stored.</strong> Each
          payment is a one-off M-Pesa prompt sent to the number you enter at the time.
        </Fact>
      </ul>
    </Card>
  );
}

function Fact({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 text-body-sm text-muted">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

/** Small inline warning used where a lapsed plan blocks something. */
export function EntitlementNotice({ feature }: { feature: string }) {
  return (
    <Alert tone="warning" title={`${feature} needs an active plan`}>
      <span className="flex flex-wrap items-center gap-1">
        Your plan has ended, so this is switched off.
        <Link href="/dashboard/billing" className="underline">
          Renew to turn it back on
        </Link>
      </span>
    </Alert>
  );
}

export const ENTITLEMENT_ICONS = { CircleAlert, TriangleAlert };
