import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_ORDER,
  planFor,
  effectivePlan,
  purchasedPlan,
  subscriptionState,
  withinProfileLimit,
  daysUntil,
  formatKes,
  EXPIRY_WARNING_DAYS,
  type SubscriptionRow,
} from "./plans";

const NOW = new Date("2026-08-15T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const sub = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  plan_code: "pro",
  status: "active",
  current_period_end: inDays(200),
  ...over,
});

describe("planFor", () => {
  it("resolves known plans and falls back to free", () => {
    expect(planFor("pro").code).toBe("pro");
    expect(planFor(null).code).toBe("free");
    expect(planFor("enterprise").code).toBe("free");
  });
});

describe("subscriptionState", () => {
  it("is active well inside the paid period", () => {
    expect(subscriptionState(sub(), NOW)).toBe("active");
  });

  it("warns as the period end approaches", () => {
    expect(subscriptionState(sub({ current_period_end: inDays(10) }), NOW)).toBe("expiring");
    expect(
      subscriptionState(sub({ current_period_end: inDays(EXPIRY_WARNING_DAYS) }), NOW),
    ).toBe("expiring");
    expect(
      subscriptionState(sub({ current_period_end: inDays(EXPIRY_WARNING_DAYS + 1) }), NOW),
    ).toBe("active");
  });

  /** Audit item B13 — the case that had no handling at all before UI-9. */
  it("is expired once the period has passed", () => {
    expect(subscriptionState(sub({ current_period_end: inDays(-1) }), NOW)).toBe("expired");
    expect(subscriptionState(sub({ current_period_end: inDays(-400) }), NOW)).toBe("expired");
  });

  it("treats a provider problem as inactive regardless of dates", () => {
    expect(subscriptionState(sub({ status: "past_due" }), NOW)).toBe("inactive");
  });

  it("is free for a free plan or no subscription at all", () => {
    expect(subscriptionState(null, NOW)).toBe("free");
    expect(subscriptionState({ plan_code: "free" }, NOW)).toBe("free");
  });

  /**
   * Failing safe here means continuing to serve a paying customer, not cutting
   * them off because a timestamp is missing.
   */
  it("keeps a paid plan active when no end date was recorded", () => {
    expect(subscriptionState(sub({ current_period_end: null }), NOW)).toBe("active");
  });

  it("does not crash on an unparseable date", () => {
    expect(subscriptionState(sub({ current_period_end: "not-a-date" }), NOW)).toBe("active");
  });
});

describe("effectivePlan", () => {
  it("grants the paid plan while it is in good standing", () => {
    expect(effectivePlan(sub(), NOW).code).toBe("pro");
    expect(effectivePlan(sub({ current_period_end: inDays(5) }), NOW).code).toBe("pro");
  });

  /**
   * The bug B13 describes: before this, a lapsed annual subscription kept every
   * paid feature indefinitely.
   */
  it("drops to free the moment the period ends", () => {
    const lapsed = sub({ current_period_end: inDays(-1) });
    expect(effectivePlan(lapsed, NOW).code).toBe("free");
    expect(effectivePlan(lapsed, NOW).limits.leadCapture).toBe(false);
    expect(effectivePlan(lapsed, NOW).limits.maxProfiles).toBe(1);
  });

  it("drops to free when the provider reports a problem", () => {
    expect(effectivePlan(sub({ status: "past_due" }), NOW).code).toBe("free");
  });

  it("still reports what was purchased, for the billing screen", () => {
    const lapsed = sub({ current_period_end: inDays(-1) });
    expect(purchasedPlan(lapsed).code).toBe("pro");
    expect(effectivePlan(lapsed, NOW).code).toBe("free");
  });

  it("is exact at the boundary", () => {
    expect(effectivePlan(sub({ current_period_end: inDays(-0.5) }), NOW).code).toBe("free");
    expect(effectivePlan(sub({ current_period_end: inDays(0.5) }), NOW).code).toBe("pro");
  });
});

describe("withinProfileLimit", () => {
  it("enforces a finite limit", () => {
    expect(withinProfileLimit(PLANS.free, 0)).toBe(true);
    expect(withinProfileLimit(PLANS.free, 1)).toBe(false);
    expect(withinProfileLimit(PLANS.pro, 4)).toBe(true);
    expect(withinProfileLimit(PLANS.pro, 5)).toBe(false);
  });

  it("treats -1 as unlimited", () => {
    expect(withinProfileLimit(PLANS.business, 9999)).toBe(true);
  });

  /**
   * An expired Pro account with 5 profiles keeps them — they simply cannot add
   * more. Entitlements lapsing must never destroy an owner's existing work.
   */
  it("blocks new profiles for a lapsed plan without touching existing ones", () => {
    const lapsed = effectivePlan(sub({ current_period_end: inDays(-1) }), NOW);
    expect(withinProfileLimit(lapsed, 5)).toBe(false);
  });
});

describe("daysUntil", () => {
  it("counts forward and backward", () => {
    expect(daysUntil(inDays(10), NOW)).toBe(10);
    expect(daysUntil(inDays(-3), NOW)).toBe(-3);
  });

  it("returns null for missing or invalid input", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil(undefined, NOW)).toBeNull();
    expect(daysUntil("nonsense", NOW)).toBeNull();
  });
});

describe("plan catalogue", () => {
  it("orders plans and keeps limits monotonic", () => {
    expect(PLAN_ORDER).toEqual(["free", "starter", "pro", "business"]);
    // A more expensive plan must never grant less.
    const rank = (n: number) => (n < 0 ? Infinity : n);
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const prev = PLANS[PLAN_ORDER[i - 1]];
      const curr = PLANS[PLAN_ORDER[i]];
      expect(curr.priceKesAnnual).toBeGreaterThanOrEqual(prev.priceKesAnnual);
      expect(rank(curr.limits.maxProfiles)).toBeGreaterThanOrEqual(rank(prev.limits.maxProfiles));
    }
  });

  it("formats Kenyan shillings", () => {
    expect(formatKes(15000)).toBe("KES 15,000");
    expect(formatKes(0)).toBe("KES 0");
  });
});
