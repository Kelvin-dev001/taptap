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

export function planFor(code: string | null | undefined): Plan {
  return PLANS[(code as PlanCode) ?? "free"] ?? PLANS.free;
}

export function withinProfileLimit(plan: Plan, currentCount: number): boolean {
  return plan.limits.maxProfiles < 0 || currentCount < plan.limits.maxProfiles;
}
