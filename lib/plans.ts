// Plan definitions — the single source of truth for pricing + limits.
// NOTE: priceKesAnnual values are DRAFT — replace with Kelvin's confirmed KES amounts.

export type PlanCode = "free" | "starter" | "pro" | "business";

export type PlanLimits = {
  maxProfiles: number; // -1 = unlimited
  customBranding: boolean; // remove TapTap branding, custom colors
  leadCapture: boolean;
  advancedAnalytics: boolean;
};

export type Plan = {
  code: PlanCode;
  name: string;
  priceKesAnnual: number; // 0 for free — DRAFT, confirm
  limits: PlanLimits;
};

export const PLANS: Record<PlanCode, Plan> = {
  free: {
    code: "free",
    name: "Free",
    priceKesAnnual: 0,
    limits: { maxProfiles: 1, customBranding: false, leadCapture: false, advancedAnalytics: false },
  },
  starter: {
    code: "starter",
    name: "Starter",
    priceKesAnnual: 5000, // DRAFT
    limits: { maxProfiles: 1, customBranding: true, leadCapture: false, advancedAnalytics: false },
  },
  pro: {
    code: "pro",
    name: "Pro",
    priceKesAnnual: 15000, // DRAFT
    limits: { maxProfiles: 5, customBranding: true, leadCapture: true, advancedAnalytics: true },
  },
  business: {
    code: "business",
    name: "Business",
    priceKesAnnual: 40000, // DRAFT
    limits: { maxProfiles: -1, customBranding: true, leadCapture: true, advancedAnalytics: true },
  },
};

export const PLAN_ORDER: PlanCode[] = ["free", "starter", "pro", "business"];

/**
 * Prices in this file have carried a DRAFT marker since Sprint 4. M-Pesa STK
 * push charges real money against these numbers, so they must be confirmed
 * before launch. Exported so a pre-launch check can assert on it.
 */
export const PRICES_ARE_DRAFT = true;

export function planFor(code: string | null | undefined): Plan {
  return PLANS[(code as PlanCode) ?? "free"] ?? PLANS.free;
}

/** The subscription shape the app reads; matches the columns selected everywhere. */
export type SubscriptionRow = {
  plan_code?: string | null;
  status?: string | null;
  current_period_end?: string | null;
};

export type SubscriptionState =
  /** No paid plan, or never had one. */
  | "free"
  /** Paid and in good standing. */
  | "active"
  /** Paid, in good standing, and ending within the warning window. */
  | "expiring"
  /** Paid at some point, but the period has ended. */
  | "expired"
  /** Provider reported a problem — payment failed or was reversed. */
  | "inactive";

/** How many days before expiry the UI starts warning. */
export const EXPIRY_WARNING_DAYS = 30;

export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

/**
 * Classify a subscription, honouring the end of the paid period.
 *
 * Audit item B13, open since UI-0: nothing checked `current_period_end`, so a
 * lapsed annual subscription kept every paid feature indefinitely and the
 * billing screen reported a plan the customer had stopped paying for.
 */
export function subscriptionState(
  sub: SubscriptionRow | null | undefined,
  now: Date = new Date(),
): SubscriptionState {
  const code = (sub?.plan_code as PlanCode) ?? "free";
  if (!sub || code === "free" || !PLANS[code]) return "free";

  // A provider-reported problem outranks the dates.
  if (sub.status && sub.status !== "active") return "inactive";

  const remaining = daysUntil(sub.current_period_end, now);
  // A paid plan with no end date is treated as active rather than expired: the
  // safe failure here is to keep serving a paying customer, not to cut them off
  // because of a missing timestamp.
  if (remaining === null) return "active";
  if (remaining <= 0) return "expired";
  if (remaining <= EXPIRY_WARNING_DAYS) return "expiring";
  return "active";
}

/**
 * The plan whose limits actually apply right now.
 *
 * Every entitlement check must go through this rather than `planFor(plan_code)`,
 * which reports what was bought rather than what is still owned.
 */
export function effectivePlan(
  sub: SubscriptionRow | null | undefined,
  now: Date = new Date(),
): Plan {
  const state = subscriptionState(sub, now);
  if (state === "expired" || state === "inactive" || state === "free") return PLANS.free;
  return planFor(sub?.plan_code);
}

/** The plan the customer paid for, regardless of whether it still applies. */
export function purchasedPlan(sub: SubscriptionRow | null | undefined): Plan {
  return planFor(sub?.plan_code);
}

export function withinProfileLimit(plan: Plan, currentCount: number): boolean {
  return plan.limits.maxProfiles < 0 || currentCount < plan.limits.maxProfiles;
}

export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE")}`;
}
