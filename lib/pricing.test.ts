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
  PRODUCTS,
  SELLABLE_PRODUCTS,
  isProductCode,
  deliveryFeeKes,
  isDeliveryZone,
  orderTotalKes,
  replacementProductFor,
  REPLACEMENT_PRICE_KES,
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

/**
 * Products, delivery and totals (D-026, D-028).
 */
describe("the product catalogue", () => {
  it("prices each product as decided", () => {
    expect(PRODUCTS.smart_card.priceKes).toBe(1_500);
    expect(PRODUCTS.smart_card_premium.priceKes).toBe(2_500);
    expect(PRODUCTS.smart_stand.priceKes).toBe(2_000);
    expect(PRODUCTS.smart_card_replacement.priceKes).toBe(1_000);
  });

  /**
   * D-018: the billing unit is the identity, and a Premium card is one identity
   * exactly like a Standard one. If `kind` ever diverged, a Premium customer
   * would renew at a different price from the one they were sold.
   */
  it("bills every card as a card, whatever it is printed with", () => {
    for (const p of Object.values(PRODUCTS)) {
      if (p.code === "smart_stand") continue;
      expect(p.kind).toBe("card");
    }
    expect(PRODUCTS.smart_stand.kind).toBe("stand");
  });

  /**
   * A replacement buys plastic, not an identity. Provisioning one would charge
   * the customer twice for a thing they already own.
   */
  it("does not provision an identity for a replacement", () => {
    expect(PRODUCTS.smart_card_replacement.provisionsIdentity).toBe(false);
    expect(PRODUCTS.smart_card_premium_replacement.provisionsIdentity).toBe(false);
    expect(PRODUCTS.smart_card.provisionsIdentity).toBe(true);
  });

  it("bundles no months into a replacement, because the term travels with the identity", () => {
    expect(PRODUCTS.smart_card_replacement.bundledMonths).toBe(0);
    expect(PRODUCTS.smart_card.bundledMonths).toBe(BUNDLED_MONTHS);
  });

  it("offers only the three sellable products at checkout", () => {
    expect(SELLABLE_PRODUCTS.map((p) => p.code)).toEqual([
      "smart_card",
      "smart_card_premium",
      "smart_stand",
    ]);
    for (const p of SELLABLE_PRODUCTS) expect(p.sellable).toBe(true);
  });

  /** A replacement is reached from the Devices screen, never from the shop. */
  it("keeps replacements out of the chooser", () => {
    expect(SELLABLE_PRODUCTS.map((p) => p.code)).not.toContain("smart_card_replacement");
  });

  it("recognises only real product codes", () => {
    expect(isProductCode("smart_card")).toBe(true);
    expect(isProductCode("smart_card_premium")).toBe(true);
    expect(isProductCode("gold_card")).toBe(false);
    expect(isProductCode(null)).toBe(false);
  });

  /**
   * A dozen surfaces ask "what does a card cost" without caring which SKU. The
   * honest answer is the entry price, and deriving it means it cannot drift away
   * from the Standard Card it quotes.
   */
  it("derives the headline hardware price from the catalogue", () => {
    expect(HARDWARE_PRICE_KES.card).toBe(PRODUCTS.smart_card.priceKes);
    expect(HARDWARE_PRICE_KES.stand).toBe(PRODUCTS.smart_stand.priceKes);
  });

  /** Non-colour, non-jargon communication: every product needs a plain line (§24). */
  it("gives every sellable product a name and a blurb", () => {
    for (const p of SELLABLE_PRODUCTS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
  });

  /** House style: no em dashes in anything a customer reads. */
  it("uses no em dashes in customer-facing product copy", () => {
    for (const p of Object.values(PRODUCTS)) {
      expect(p.name).not.toContain("—");
      expect(p.blurb).not.toContain("—");
    }
  });
});

describe("delivery", () => {
  const rates = [
    { zone: "mombasa", label: "Mombasa", fee_kes: 0 },
    { zone: "nairobi", label: "Nairobi", fee_kes: 0 },
    { zone: "other", label: "Another town", fee_kes: 300 },
  ];

  it("is free where a rider can reach it", () => {
    expect(deliveryFeeKes("mombasa", rates)).toBe(0);
    expect(deliveryFeeKes("nairobi", rates)).toBe(0);
  });

  it("charges for anywhere a courier has to go", () => {
    expect(deliveryFeeKes("other", rates)).toBe(300);
  });

  /**
   * No hard-coded fallback, deliberately. A default here would be the second
   * copy of the number that D-018 forbids, and the failure it would hide —
   * rates not loading — must be visible at checkout rather than quietly
   * charging the wrong amount. Zero is the safe direction: we absorb a
   * delivery rather than overcharge somebody.
   */
  it("charges nothing rather than guessing when the rates are missing", () => {
    expect(deliveryFeeKes("other", [])).toBe(0);
    expect(deliveryFeeKes("other", null)).toBe(0);
    expect(deliveryFeeKes("atlantis", rates)).toBe(0);
    expect(deliveryFeeKes(null, rates)).toBe(0);
  });

  it("ignores a rate that has been switched off", () => {
    expect(deliveryFeeKes("other", [{ ...rates[2], is_active: false }])).toBe(0);
  });

  it("recognises only real zones", () => {
    expect(isDeliveryZone("mombasa")).toBe(true);
    expect(isDeliveryZone("other")).toBe(true);
    expect(isDeliveryZone("kisumu")).toBe(false);
    expect(isDeliveryZone(null)).toBe(false);
  });
});

describe("orderTotalKes", () => {
  it("adds the cards and the delivery", () => {
    expect(orderTotalKes(PRODUCTS.smart_card, 2, 300)).toBe(3_300);
    expect(orderTotalKes(PRODUCTS.smart_card_premium, 1, 0)).toBe(2_500);
  });

  /**
   * One fee per order regardless of what is in the parcel: a card and a stand
   * cost the same to put on a shuttle, and a rate table with a row per product
   * is one nobody keeps current.
   */
  it("charges delivery once however many are in the box", () => {
    expect(orderTotalKes(PRODUCTS.smart_card, 5, 300)).toBe(5 * 1_500 + 300);
  });

  it("refuses to price nothing", () => {
    expect(orderTotalKes(PRODUCTS.smart_card, 0, 300)).toBe(0);
    expect(orderTotalKes(PRODUCTS.smart_card, -1, 300)).toBe(0);
    expect(orderTotalKes(PRODUCTS.smart_card, Number.NaN, 300)).toBe(0);
  });

  it("treats a nonsense fee as no fee rather than as a negative charge", () => {
    expect(orderTotalKes(PRODUCTS.smart_card, 1, -500)).toBe(1_500);
    expect(orderTotalKes(PRODUCTS.smart_card, 1, Number.NaN)).toBe(1_500);
  });

  it("ignores a fractional quantity rather than charging a fraction of a card", () => {
    expect(orderTotalKes(PRODUCTS.smart_card, 2.9, 0)).toBe(3_000);
  });
});

/**
 * A replacement has to match what was lost.
 *
 * A Premium card's front is printed with artwork the customer approved; a
 * Standard replacement of one would arrive as something they never agreed to,
 * for the same money.
 */
describe("replacementProductFor", () => {
  it("replaces Premium with Premium", () => {
    expect(replacementProductFor("premium").code).toBe("smart_card_premium_replacement");
    expect(replacementProductFor("premium").path).toBe("custom");
  });

  it("replaces Standard with Standard", () => {
    expect(replacementProductFor("standard").code).toBe("smart_card_replacement");
    expect(replacementProductFor("standard").path).toBe("stock");
  });

  /** An unknown or missing variant is a pre-stock-model card: Standard. */
  it("falls back to Standard for a card with no variant", () => {
    expect(replacementProductFor(null).code).toBe("smart_card_replacement");
    expect(replacementProductFor(undefined).code).toBe("smart_card_replacement");
    expect(replacementProductFor("nonsense").code).toBe("smart_card_replacement");
  });

  /** The billing unit is the identity, not the plastic (D-018). */
  it("provisions no identity and bundles no months, at the replacement price", () => {
    for (const v of ["standard", "premium"]) {
      const p = replacementProductFor(v);
      expect(p.provisionsIdentity).toBe(false);
      expect(p.bundledMonths).toBe(0);
      expect(p.priceKes).toBe(REPLACEMENT_PRICE_KES);
    }
  });

  /** Never in the product chooser: a replacement starts from a specific card. */
  it("is not sellable from the ordinary checkout", () => {
    expect(replacementProductFor("standard").sellable).toBe(false);
    expect(replacementProductFor("premium").sellable).toBe(false);
  });
});
