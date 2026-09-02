import { describe, it, expect } from "vitest";
import {
  HARDWARE_PRICE_KES,
  RENEWAL_PER_IDENTITY_KES,
  BUNDLED_MONTHS,
  SEGMENTS,
  SEGMENT_ORDER,
  INACTIVE_ENTITLEMENTS,
  ACTIVE_ENTITLEMENTS,
  entitlementsFor,
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
   * The commercial heart of D-021: an account that owns nothing gets the
   * inactive set, and the profile it built stays a draft. There is no free tier
   * to fall back to, and this is the assertion that says so.
   */
  it("gives an account with no active device the inactive set", () => {
    expect(entitlementsFor(0)).toEqual(INACTIVE_ENTITLEMENTS);
    expect(entitlementsFor(0).leadCapture).toBe(false);
    expect(entitlementsFor(0).analytics).toBe("basic");
    expect(entitlementsFor(0).customBranding).toBe(false);
  });

  /**
   * One paid set, not three (D-024). With no segment stored on the account,
   * paying is the only axis left, and a per-segment feature gate would be
   * unimplementable even if we wanted one.
   */
  it("unlocks everything once one device is active", () => {
    expect(entitlementsFor(1)).toEqual(ACTIVE_ENTITLEMENTS);
    expect(entitlementsFor(1).leadCapture).toBe(true);
    expect(entitlementsFor(1).analytics).toBe("full");
    expect(entitlementsFor(1).customBranding).toBe(true);
  });

  it("does not give more for owning more", () => {
    expect(entitlementsFor(12)).toEqual(entitlementsFor(1));
  });

  /**
   * Team management is deferred (D-017) and §15 forbids selling what we have
   * not shipped. The flag exists so the gate is ready; it must stay false until
   * the feature is real.
   */
  it("never claims team management, because it is not built", () => {
    expect(ACTIVE_ENTITLEMENTS.teamManagement).toBe(false);
    expect(INACTIVE_ENTITLEMENTS.teamManagement).toBe(false);
  });
});

describe("segment catalogue", () => {
  /**
   * Segments are marketing packaging and must carry no entitlements (D-024).
   * Attaching feature flags to them is exactly how the per-account plans D-018
   * removed came into being, so this asserts the shape rather than the content.
   */
  it("carries no entitlements at all", () => {
    for (const code of SEGMENT_ORDER) {
      expect(SEGMENTS[code]).not.toHaveProperty("entitlements");
    }
  });

  it("lists the three the pricing page shows", () => {
    expect(SEGMENT_ORDER).toEqual(["individual", "business", "corporate"]);
  });

  it("sends Corporate to sales rather than to a self-serve checkout", () => {
    expect(SEGMENTS.corporate.salesLed).toBe(true);
    expect(SEGMENTS.individual.salesLed).toBe(false);
    expect(SEGMENTS.business.salesLed).toBe(false);
  });

  it("shows stands to the segments that can use several devices", () => {
    expect(SEGMENTS.individual.deviceKinds).toEqual(["card"]);
    expect(SEGMENTS.business.deviceKinds).toContain("stand");
  });
});
