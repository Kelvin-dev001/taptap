import { describe, it, expect } from "vitest";
import {
  identityState,
  isLive,
  activeIdentityCount,
  billableIdentities,
  identitiesDueWithin,
  accountRenewalDate,
  billingSummary,
  renewalAmountKes,
  daysUntil,
  IDENTITY_STATE_META,
  type IdentityRow,
} from "./identity";
import { GRACE_DAYS, RENEWAL_WARNING_DAYS } from "./pricing";

const NOW = new Date("2026-08-30T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const tag = (over: Partial<IdentityRow> = {}): IdentityRow => ({
  id: over.id ?? "tag-1",
  account_id: "acct-1",
  status: "assigned",
  kind: "card",
  term_end: inDays(200),
  ...over,
});

describe("identityState", () => {
  it("is active well inside the term", () => {
    expect(identityState(tag(), NOW)).toBe("active");
  });

  it("warns as the term end approaches", () => {
    expect(identityState(tag({ term_end: inDays(10) }), NOW)).toBe("expiring");
    expect(identityState(tag({ term_end: inDays(RENEWAL_WARNING_DAYS) }), NOW)).toBe("expiring");
    expect(identityState(tag({ term_end: inDays(RENEWAL_WARNING_DAYS + 1) }), NOW)).toBe(
      "active",
    );
  });

  /**
   * The grace window exists because the reader of a dead card is usually the
   * cardholder's customer, not the person who failed to pay.
   */
  it("keeps working through the grace window, then stops", () => {
    expect(identityState(tag({ term_end: inDays(-1) }), NOW)).toBe("grace");
    expect(identityState(tag({ term_end: inDays(-(GRACE_DAYS - 1)) }), NOW)).toBe("grace");
    expect(identityState(tag({ term_end: inDays(-GRACE_DAYS) }), NOW)).toBe("expired");
    expect(identityState(tag({ term_end: inDays(-400) }), NOW)).toBe("expired");
  });

  it("is exact at the boundaries", () => {
    expect(isLive(identityState(tag({ term_end: inDays(-0.5) }), NOW))).toBe(true);
    expect(isLive(identityState(tag({ term_end: inDays(-GRACE_DAYS - 0.5) }), NOW))).toBe(false);
  });

  it("treats an unowned tag as unclaimed and a switched-off one as disabled", () => {
    expect(identityState(tag({ account_id: null }), NOW)).toBe("unclaimed");
    expect(identityState(tag({ status: "disabled" }), NOW)).toBe("disabled");
    expect(identityState(null, NOW)).toBe("unclaimed");
  });

  /**
   * Fail open. Darkening a card in a customer's hand over a missing timestamp
   * is a far worse failure than briefly over-serving, and the 0015 backfill
   * leaves NULL terms behind on purpose.
   */
  it("stays live when no term was ever recorded", () => {
    expect(identityState(tag({ term_end: null }), NOW)).toBe("active");
    expect(identityState(tag({ term_end: "not-a-date" }), NOW)).toBe("active");
  });

  it("lets a disabled card outrank its dates", () => {
    expect(identityState(tag({ status: "disabled", term_end: inDays(200) }), NOW)).toBe(
      "disabled",
    );
  });
});

describe("activeIdentityCount", () => {
  it("counts only devices that still resolve", () => {
    const tags = [
      tag({ id: "a", term_end: inDays(100) }), // active
      tag({ id: "b", term_end: inDays(5) }), // expiring — still live
      tag({ id: "c", term_end: inDays(-2) }), // grace — still live
      tag({ id: "d", term_end: inDays(-90) }), // expired
      tag({ id: "e", status: "disabled" }), // switched off
      tag({ id: "f", account_id: null }), // unclaimed
    ];
    expect(activeIdentityCount(tags, NOW)).toBe(3);
  });

  it("is zero for an account with nothing", () => {
    expect(activeIdentityCount([], NOW)).toBe(0);
    expect(activeIdentityCount(null, NOW)).toBe(0);
  });
});

describe("billableIdentities", () => {
  /**
   * A lapsed device IS billable — renewing it is exactly what brings it back.
   * A disabled one is not: an owner should never be charged to keep a card off.
   */
  it("includes lapsed devices and excludes disabled and unclaimed ones", () => {
    const tags = [
      tag({ id: "a", term_end: inDays(100) }),
      tag({ id: "b", term_end: inDays(-90) }),
      tag({ id: "c", status: "disabled" }),
      tag({ id: "d", account_id: null }),
    ];
    expect(billableIdentities(tags, NOW).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("identitiesDueWithin", () => {
  it("catches what falls due in the window, including what already lapsed", () => {
    const tags = [
      tag({ id: "soon", term_end: inDays(20) }),
      tag({ id: "later", term_end: inDays(300) }),
      tag({ id: "lapsed", term_end: inDays(-100) }),
      tag({ id: "off", status: "disabled", term_end: inDays(1) }),
    ];
    expect(identitiesDueWithin(tags, 60, NOW).map((t) => t.id)).toEqual(["soon", "lapsed"]);
  });

  /** Nothing is owed on a device that has no recorded term, so nothing is due. */
  it("never bills a device with no term", () => {
    expect(identitiesDueWithin([tag({ term_end: null })], 60, NOW)).toEqual([]);
  });
});

describe("accountRenewalDate", () => {
  /**
   * Derived from the terms rather than stored alongside them: a second copy of
   * this date is a second thing that can be wrong.
   */
  it("is the earliest term end across billable devices", () => {
    const tags = [
      tag({ id: "a", term_end: inDays(300) }),
      tag({ id: "b", term_end: inDays(40) }),
      tag({ id: "c", term_end: inDays(120) }),
    ];
    expect(accountRenewalDate(tags, NOW)).toBe(inDays(40));
  });

  it("ignores disabled devices and missing terms", () => {
    const tags = [
      tag({ id: "a", status: "disabled", term_end: inDays(1) }),
      tag({ id: "b", term_end: null }),
      tag({ id: "c", term_end: inDays(90) }),
    ];
    expect(accountRenewalDate(tags, NOW)).toBe(inDays(90));
  });

  it("is null when there is nothing to renew", () => {
    expect(accountRenewalDate([], NOW)).toBeNull();
  });
});

describe("billingSummary", () => {
  /**
   * Consolidated renewal is a billing ACTION over per-identity terms, not a
   * shared date — so the amount is simply how many fall due, times the price.
   */
  it("prices the consolidated renewal as count times the per-device price", () => {
    const tags = [
      tag({ id: "a", term_end: inDays(10) }),
      tag({ id: "b", term_end: inDays(20) }),
      tag({ id: "c", term_end: inDays(-100) }),
      tag({ id: "d", term_end: inDays(300) }),
    ];
    const summary = billingSummary(tags, NOW, 60);

    expect(summary.due.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(summary.dueAmountKes).toBe(renewalAmountKes(3));
    expect(summary.dueAmountKes).toBe(3000);
    expect(summary.billable).toBe(4);
    expect(summary.active).toBe(3); // "c" has lapsed past grace
    expect(summary.hasLapsed).toBe(true);
    expect(summary.renewsOn).toBe(inDays(-100));
  });

  it("reports an empty account honestly", () => {
    const summary = billingSummary([], NOW);
    expect(summary).toEqual({
      active: 0,
      billable: 0,
      due: [],
      dueAmountKes: 0,
      renewsOn: null,
      hasLapsed: false,
    });
  });

  it("does not claim a lapse while a device is still in grace", () => {
    const summary = billingSummary([tag({ term_end: inDays(-1) })], NOW);
    expect(summary.hasLapsed).toBe(false);
    expect(summary.active).toBe(1);
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

describe("state metadata", () => {
  /** Non-colour status communication is a WCAG 2.2 requirement (§24). */
  it("gives every state a label and a description, not just a colour", () => {
    for (const meta of Object.values(IDENTITY_STATE_META)) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("distinguishes overdue-but-working from stopped", () => {
    expect(IDENTITY_STATE_META.grace.tone).toBe("warning");
    expect(IDENTITY_STATE_META.expired.tone).toBe("danger");
  });
});
