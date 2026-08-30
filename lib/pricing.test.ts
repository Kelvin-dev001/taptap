import { describe, it, expect } from "vitest";
import {
  HARDWARE_PRICE_KES,
  RENEWAL_PER_IDENTITY_KES,
  BUNDLED_MONTHS,
  SEGMENTS,
  SEGMENT_ORDER,
  FREE_ENTITLEMENTS,
  entitlementsFor,
  segmentFor,
  suggestedSegment,
  renewalAmountKes,
  hardwareAmountKes,
  addMonths,
  termEndFromPurchase,
  renewedTermEnd,
  formatKes,
} from "./pricing";

describe("prices", () => {
  /**
   * These are the confirmed numbers (D-018), not the Sprint 4 drafts. M-Pesa
   * charges real money against them, so they are asserted rather than assumed.
   */
  it("are the confirmed Kenyan amounts", () => {
    expect(HARDWARE_PRICE_KES.card).toBe(1500);
    expect(HARDWARE_PRICE_KES.stand).toBe(2000);
    expect(RENEWAL_PER_IDENTITY_KES).toBe(1000);
    expect(BUNDLED_MONTHS).toBe(12);
  });

  it("formats Kenyan shillings", () => {
    expect(formatKes(1500)).toBe("KES 1,500");
    expect(formatKes(0)).toBe("KES 0");
  });
});

describe("renewalAmountKes", () => {
  it("is count times the per-identity price", () => {
    expect(renewalAmountKes(1)).toBe(1000);
    expect(renewalAmountKes(3)).toBe(3000);
    expect(renewalAmountKes(12)).toBe(12000);
  });

  /** An STK push for 0 or NaN would be a real charge attempt on nonsense. */
  it("refuses to produce a charge from nothing", () => {
    expect(renewalAmountKes(0)).toBe(0);
    expect(renewalAmountKes(-2)).toBe(0);
    expect(renewalAmountKes(Number.NaN)).toBe(0);
    expect(renewalAmountKes(2.7)).toBe(2000);
  });
});

describe("hardwareAmountKes", () => {
  it("multiplies by quantity", () => {
    expect(hardwareAmountKes("card")).toBe(1500);
    expect(hardwareAmountKes("card", 3)).toBe(4500);
    expect(hardwareAmountKes("stand", 2)).toBe(4000);
  });

  it("is zero for a nonsense quantity", () => {
    expect(hardwareAmountKes("card", 0)).toBe(0);
    expect(hardwareAmountKes("stand", -1)).toBe(0);
  });
});

describe("addMonths", () => {
  it("lands on the same day a year later", () => {
    expect(addMonths(new Date("2026-03-03T09:00:00Z"), 12).toISOString()).toBe(
      "2027-03-03T09:00:00.000Z",
    );
  });

  /**
   * Calendar months rather than +365 days: a customer who buys on 3 March
   * expects to renew on 3 March, and day arithmetic drifts every leap year.
   */
  it("does not drift across a leap year", () => {
    expect(addMonths(new Date("2027-03-01T00:00:00Z"), 12).toISOString()).toBe(
      "2028-03-01T00:00:00.000Z",
    );
  });

  it("clamps 29 February to 28 February", () => {
    expect(addMonths(new Date("2028-02-29T12:00:00Z"), 12).toISOString()).toBe(
      "2029-02-28T12:00:00.000Z",
    );
  });

  it("clamps a 31st into a short month", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });
});

describe("termEndFromPurchase", () => {
  it("gives exactly the bundled twelve months", () => {
    expect(termEndFromPurchase(new Date("2026-08-30T10:00:00Z")).toISOString()).toBe(
      "2027-08-30T10:00:00.000Z",
    );
  });
});

describe("renewedTermEnd", () => {
  const now = new Date("2026-08-30T00:00:00Z");

  /**
   * The rule the M-Pesa callback has always used, moved here so hardware and
   * renewal share one implementation: renewing early must ADD a year rather
   * than discard the time already paid for.
   */
  it("extends from the existing end when renewing early", () => {
    expect(renewedTermEnd("2026-11-30T00:00:00Z", now).toISOString()).toBe(
      "2027-11-30T00:00:00.000Z",
    );
  });

  it("extends from today when the term has already lapsed", () => {
    expect(renewedTermEnd("2026-01-01T00:00:00Z", now).toISOString()).toBe(
      "2027-08-30T00:00:00.000Z",
    );
  });

  it("starts a fresh year when there is no term at all", () => {
    expect(renewedTermEnd(null, now).toISOString()).toBe("2027-08-30T00:00:00.000Z");
  });

  it("does not crash on an unparseable date", () => {
    expect(renewedTermEnd("not-a-date", now).toISOString()).toBe("2027-08-30T00:00:00.000Z");
  });
});

describe("entitlements", () => {
  /**
   * The commercial heart of D-018: building a profile is free, but the two
   * capabilities worth paying for are not. Without this, the entire software
   * product is obtainable by sharing a slug and never buying hardware.
   */
  it("gives an account with no active device the free set", () => {
    expect(entitlementsFor("business", 0)).toEqual(FREE_ENTITLEMENTS);
    expect(entitlementsFor("commercial", 0).leadCapture).toBe(false);
    expect(entitlementsFor("commercial", 0).analytics).toBe("basic");
  });

  it("unlocks the segment's set once one device is active", () => {
    expect(entitlementsFor("professional", 1).leadCapture).toBe(true);
    expect(entitlementsFor("business", 1).analytics).toBe("full");
    expect(entitlementsFor("business", 1).customBranding).toBe(true);
    expect(entitlementsFor("commercial", 1).teamManagement).toBe(true);
  });

  it("keeps Professional on the basic report and Hornbill branding", () => {
    expect(entitlementsFor("professional", 3).analytics).toBe("basic");
    expect(entitlementsFor("professional", 3).customBranding).toBe(false);
  });

  it("falls back to Professional for an unknown segment", () => {
    expect(segmentFor("enterprise").code).toBe("professional");
    expect(segmentFor(null).code).toBe("professional");
  });

  /** Team management is deferred (D-017) but the gate must already exist. */
  it("reserves team management for Commercial", () => {
    expect(SEGMENTS.professional.entitlements.teamManagement).toBe(false);
    expect(SEGMENTS.business.entitlements.teamManagement).toBe(false);
    expect(SEGMENTS.commercial.entitlements.teamManagement).toBe(true);
  });
});

describe("suggestedSegment", () => {
  it("follows holdings for self-serve accounts", () => {
    expect(suggestedSegment(0)).toBe("professional");
    expect(suggestedSegment(1)).toBe("professional");
    expect(suggestedSegment(2)).toBe("business");
  });

  /**
   * Commercial is a negotiated relationship, so buying one fewer card must
   * never silently demote an account out of its agreement.
   */
  it("never infers or overwrites Commercial", () => {
    expect(suggestedSegment(9)).toBe("business");
    expect(suggestedSegment(1, "commercial")).toBe("commercial");
    expect(suggestedSegment(0, "commercial")).toBe("commercial");
  });
});

describe("segment catalogue", () => {
  it("never grants less as it goes up", () => {
    expect(SEGMENT_ORDER).toEqual(["professional", "business", "commercial"]);
    const rank = { basic: 0, full: 1 } as const;
    for (let i = 1; i < SEGMENT_ORDER.length; i++) {
      const prev = SEGMENTS[SEGMENT_ORDER[i - 1]].entitlements;
      const curr = SEGMENTS[SEGMENT_ORDER[i]].entitlements;
      expect(rank[curr.analytics]).toBeGreaterThanOrEqual(rank[prev.analytics]);
      expect(Number(curr.customBranding)).toBeGreaterThanOrEqual(Number(prev.customBranding));
      expect(Number(curr.teamManagement)).toBeGreaterThanOrEqual(Number(prev.teamManagement));
    }
  });

  it("sells Commercial without a public checkout", () => {
    expect(SEGMENTS.commercial.salesLed).toBe(true);
    expect(SEGMENTS.professional.salesLed).toBe(false);
    expect(SEGMENTS.business.salesLed).toBe(false);
  });

  it("sells stands only to segments that can use several devices", () => {
    expect(SEGMENTS.professional.deviceKinds).toEqual(["card"]);
    expect(SEGMENTS.business.deviceKinds).toContain("stand");
  });
});
