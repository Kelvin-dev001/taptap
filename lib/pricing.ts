/**
 * Hornbill TapTap — the single source of truth for money (D-018).
 *
 * The billing unit is an **identity**: one physical device (card or stand) and
 * whichever Tap Profile it currently points at. The device is the identity, not
 * the (device, profile) pair — `nfc_tags.smart_page_id` is repointable by
 * design (D-009) and repointing must never create or destroy a billing unit.
 *
 * These numbers are CONFIRMED, not draft. `PRICES_ARE_DRAFT` was deleted with
 * this file's arrival; anything charging money reads from here.
 */

export type DeviceKind = "card" | "stand";

/**
 * Packaging on the pricing page, and nothing else (D-024).
 *
 * A segment is NOT stored on the account and NOT read by any gate. With the free
 * tier gone there is exactly one axis left — does this account hold a live
 * identity — so a per-segment feature gate is not merely unwanted, it is
 * unimplementable without storing a segment, and storing one would recreate the
 * per-account plan that D-018 removed.
 *
 * What a segment does is help a visitor recognise themselves: one person with
 * one card, a business with a few, an organisation that needs a quote.
 */
export type Segment = "individual" | "business" | "corporate";

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

/**
 * What a product is, and what happens in the workshop when someone buys one.
 *
 * `kind` is the BILLING unit (D-018) and stays two-valued: a Premium card is a
 * card, renews like a card, and counts as one identity. `variant` is which SKU
 * comes off the shelf, and `path` is what the workshop does with it. Three axes
 * because they genuinely vary independently — a Standard replacement is kind
 * card, variant standard, path stock, and provisions no identity at all.
 */
export type ProductCode =
  | "smart_card"
  | "smart_card_premium"
  | "smart_stand"
  | "smart_card_replacement"
  | "smart_card_premium_replacement";

/** How an order is fulfilled. Drives the pipeline in lib/orders.ts. */
export type FulfilmentPath = "stock" | "custom" | "made_to_order";

/** Which printed card a unit needs off the shelf. */
export type CardVariant = "standard" | "premium";

export type ProductDefinition = {
  code: ProductCode;
  name: string;
  kind: DeviceKind;
  variant: CardVariant | null;
  path: FulfilmentPath;
  /** One-time price. Includes `bundledMonths` of service. */
  priceKes: number;
  bundledMonths: number;
  /** False for replacements: the identity already exists and was already paid for. */
  provisionsIdentity: boolean;
  /** Whether it appears in the customer's product chooser at checkout. */
  sellable: boolean;
  /** One line, in the customer's words. Empty where there is nothing to add. */
  blurb: string;
};

export const PRODUCTS: Record<ProductCode, ProductDefinition> = {
  smart_card: {
    code: "smart_card",
    name: "Standard Card",
    kind: "card",
    variant: "standard",
    path: "stock",
    priceKes: 1_500,
    bundledMonths: 12,
    provisionsIdentity: true,
    sellable: true,
    blurb: "Ready to go. Tap it or scan it and your profile opens.",
  },
  smart_card_premium: {
    code: "smart_card_premium",
    name: "Premium Card",
    kind: "card",
    variant: "premium",
    path: "custom",
    priceKes: 2_500,
    bundledMonths: 12,
    provisionsIdentity: true,
    sellable: true,
    blurb: "Your name, title and logo printed on the front. You approve a proof before we print.",
  },
  smart_stand: {
    code: "smart_stand",
    name: "Smart Stand",
    kind: "stand",
    variant: null,
    path: "made_to_order",
    priceKes: 2_000,
    bundledMonths: 12,
    provisionsIdentity: true,
    sellable: true,
    blurb: "For a counter or a table. Made to order.",
  },
  smart_card_replacement: {
    code: "smart_card_replacement",
    name: "Replacement Card",
    kind: "card",
    variant: "standard",
    path: "stock",
    priceKes: 1_000,
    bundledMonths: 0,
    provisionsIdentity: false,
    sellable: false,
    blurb: "A new card for a profile you already own. Your remaining time comes with it.",
  },
  smart_card_premium_replacement: {
    code: "smart_card_premium_replacement",
    name: "Replacement Premium Card",
    kind: "card",
    variant: "premium",
    path: "custom",
    priceKes: 1_000,
    bundledMonths: 0,
    provisionsIdentity: false,
    sellable: false,
    blurb: "A new Premium card, printed from the artwork you already approved.",
  },
};

/** The products a customer can choose at checkout, in display order. */
export const SELLABLE_PRODUCTS: ProductDefinition[] = [
  PRODUCTS.smart_card,
  PRODUCTS.smart_card_premium,
  PRODUCTS.smart_stand,
];

/**
 * The replacement SKU for a card that was lost or damaged.
 *
 * Derived from the lost card rather than chosen by the customer: a Premium
 * replacement has to be Premium, because the front is printed and the customer
 * already approved that artwork. Offering the choice would let somebody pay
 * KES 1,000 for a Standard replacement of a Premium card and receive something
 * that is not what they lost.
 *
 * Both replacements cost the same and bundle no months (D-018): the billing
 * unit is the identity, not the plastic, and the identity's term carries over
 * untouched.
 */
export function replacementProductFor(
  variant: string | null | undefined,
): ProductDefinition {
  return variant === "premium"
    ? PRODUCTS.smart_card_premium_replacement
    : PRODUCTS.smart_card_replacement;
}

export function isProductCode(value: string | null | undefined): value is ProductCode {
  return Object.prototype.hasOwnProperty.call(PRODUCTS, value ?? "");
}

/**
 * One-time hardware price by device kind. **Includes the first 12 months of
 * service** — this is why buying a device starts a term rather than merely
 * shipping an object.
 *
 * Derived from PRODUCTS rather than stated again, so the cheapest card and the
 * Standard Card can never drift apart. Kept because a dozen surfaces ask "what
 * does a card cost" without caring which SKU, and the honest answer to that is
 * still the entry price.
 */
export const HARDWARE_PRICE_KES: Record<DeviceKind, number> = {
  card: PRODUCTS.smart_card.priceKes,
  stand: PRODUCTS.smart_stand.priceKes,
};

/** What a replacement piece of plastic costs, identity untouched. */
export const REPLACEMENT_PRICE_KES = PRODUCTS.smart_card_replacement.priceKes;

/** Annual renewal per active identity, charged from year 2 onward. */
export const RENEWAL_PER_IDENTITY_KES = 1_000;

/** Months of service bundled into a hardware purchase. */
export const BUNDLED_MONTHS = 12;

/** Months added by one renewal payment. */
export const RENEWAL_MONTHS = 12;

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  card: "Smart Card",
  stand: "Smart Stand",
};

// ---------------------------------------------------------------------------
// Grace and warning windows
// ---------------------------------------------------------------------------

/**
 * Days past `term_end` during which a device keeps resolving.
 *
 * A card that dies the instant a term lapses fails in front of the *cardholder's
 * customer* — someone who never had the chance to pay. The grace window buys
 * the owner time to notice without making non-payment consequence-free.
 */
export const GRACE_DAYS = 14;

/** Days before `term_end` at which the UI starts warning. */
export const RENEWAL_WARNING_DAYS = 30;

/** How far ahead "renew everything due" reaches by default. */
export const RENEWAL_BATCH_WINDOW_DAYS = 60;

/**
 * Not a plan gate — an abuse guard.
 *
 * How many profiles an account may hold is decided by how many identities it
 * owns (`maxProfiles` in lib/entitlement.ts). This is the ceiling above that:
 * a customer with fifty cards is a real customer, one with fifty thousand
 * profiles is a script. Never advertised as a limit.
 */
export const MAX_PROFILES_PER_ACCOUNT = 25;

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

/**
 * How much of the analytics report an account can see.
 *
 * Only two levels are enforced today because only two are real: `basic` shows
 * headline counts, daily activity and top actions; `full` adds source
 * attribution, per-card breakdown, geography, time-of-day and CSV export.
 * Nothing is sold as "advanced" — §15 forbids claiming capability we lack.
 */
export type AnalyticsDepth = "basic" | "full";

export type SupportTier = "standard" | "business" | "priority";

export type Entitlements = {
  analytics: AnalyticsDepth;
  /** Collect enquiries through a profile's lead form. */
  leadCapture: boolean;
  /** Hide the "Powered by Hornbill TapTap" footer on public profiles. */
  customBranding: boolean;
  /** Roles and invites on one account (D-017). Not yet built; gate is ready. */
  teamManagement: boolean;
  support: SupportTier;
};

export type SegmentDefinition = {
  code: Segment;
  name: string;
  /** Who this is for, in the owner's words. */
  audience: string;
  /** Devices this segment is typically sold. Presentation only. */
  deviceKinds: DeviceKind[];
  /** Corporate has no public checkout — it is quoted (see /quote). */
  salesLed: boolean;
};

/**
 * Marketing packaging. Carries no entitlements, by design (D-024).
 *
 * Every one of these buys the same product at the same price and gets the same
 * capabilities; what differs is quantity and how the purchase happens. Attaching
 * feature flags here is what turned into per-account plans last time.
 */
export const SEGMENTS: Record<Segment, SegmentDefinition> = {
  individual: {
    code: "individual",
    name: "Individual",
    audience: "One person, one card",
    deviceKinds: ["card"],
    salesLed: false,
  },
  business: {
    code: "business",
    name: "Business",
    audience: "SMEs running several cards and stands",
    deviceKinds: ["card", "stand"],
    salesLed: false,
  },
  corporate: {
    code: "corporate",
    name: "Corporate",
    audience: "Organisations kitting out a whole team",
    deviceKinds: ["card", "stand"],
    salesLed: true,
  },
};

export const SEGMENT_ORDER: Segment[] = ["individual", "business", "corporate"];

/**
 * What an account with **no active identity** gets.
 *
 * Building a profile and previewing it costs nothing, and that draft is
 * genuinely useful: it is how someone sees what they are buying. What it does
 * not do is go live. There is no free tier here and no free plan — this is the
 * unpaid state of an account that has not activated yet, or whose identities
 * have all lapsed.
 */
export const INACTIVE_ENTITLEMENTS: Entitlements = {
  analytics: "basic",
  leadCapture: false,
  customBranding: false,
  teamManagement: false,
  support: "standard",
};

/**
 * What an account holding at least one live identity gets.
 *
 * One set, not three. `teamManagement` stays false for everyone because it is
 * not built (D-017) and §15 forbids selling what we have not shipped; the flag
 * is kept so the gate exists on the day it is.
 */
export const ACTIVE_ENTITLEMENTS: Entitlements = {
  analytics: "full",
  leadCapture: true,
  customBranding: true,
  teamManagement: false,
  support: "standard",
};

/**
 * The entitlements that actually apply right now.
 *
 * One question decides it: does this account still own a working device. The
 * "effective versus purchased" split that `effectivePlan` established in UI-9
 * survives — an account whose every device has lapsed falls back to the inactive
 * set — but the purchased half is no longer a stored tier.
 */
export function entitlementsFor(activeIdentities: number): Entitlements {
  return activeIdentities > 0 ? ACTIVE_ENTITLEMENTS : INACTIVE_ENTITLEMENTS;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** What it costs to renew `count` identities for a year. */
export function renewalAmountKes(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count) * RENEWAL_PER_IDENTITY_KES;
}

/** What it costs to buy hardware, first 12 months included. */
export function hardwareAmountKes(kind: DeviceKind, quantity = 1): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return HARDWARE_PRICE_KES[kind] * Math.floor(quantity);
}

// ---------------------------------------------------------------------------
// Delivery (D-028)
// ---------------------------------------------------------------------------

/**
 * Where a parcel is going, priced.
 *
 * Zones rather than towns: a town list for Kenya is either wrong or enormous,
 * and the only distinction that costs us anything is whether a rider can reach
 * it today. The customer's town is recorded alongside as free text, because the
 * rider still has to find the place.
 */
export type DeliveryZone = "mombasa" | "nairobi" | "other";

export const DELIVERY_ZONES: DeliveryZone[] = ["mombasa", "nairobi", "other"];

export function isDeliveryZone(value: string | null | undefined): value is DeliveryZone {
  return DELIVERY_ZONES.includes((value ?? "") as DeliveryZone);
}

/** A row of `delivery_rates`. The table is the source of truth for the figure. */
export type DeliveryRate = {
  zone: string;
  label: string;
  fee_kes: number;
  is_active?: boolean | null;
};

/**
 * The fee for a zone, from the rates the database returned.
 *
 * Deliberately has no number of its own to fall back to. A hard-coded default
 * here would be the second copy D-018 forbids, and the failure it would hide —
 * rates not loading — is one that must be visible at checkout rather than
 * quietly charging somebody the wrong amount. An unknown zone is 0, which is the
 * safe direction to be wrong in: we absorb a delivery rather than overcharge.
 */
export function deliveryFeeKes(
  zone: string | null | undefined,
  rates: DeliveryRate[] | null | undefined,
): number {
  const match = (rates ?? []).find((r) => r.zone === zone && r.is_active !== false);
  const fee = match?.fee_kes;
  return Number.isFinite(fee) && (fee as number) > 0 ? Math.floor(fee as number) : 0;
}

/**
 * What an order costs in total: the things, plus getting them there.
 *
 * One delivery fee per order regardless of what is in the parcel — a card and a
 * stand cost the same to put on a shuttle, and a rate table with a row per
 * product is a rate table nobody keeps current.
 */
export function orderTotalKes(
  product: ProductDefinition,
  quantity: number,
  deliveryFee: number,
): number {
  const units = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  const fee = Number.isFinite(deliveryFee) && deliveryFee > 0 ? Math.floor(deliveryFee) : 0;
  if (units === 0) return 0;
  return product.priceKes * units + fee;
}

export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

/**
 * Add whole calendar months, clamping to the end of a short month.
 *
 * Calendar months rather than 365 days: a customer who buys on 3 March expects
 * to renew on 3 March, and `+365d` silently drifts a day every leap year. The
 * clamp matters for 29 February, which becomes 28 February a year later.
 */
export function addMonths(from: Date, months: number): Date {
  const day = from.getUTCDate();
  const target = new Date(from.getTime());
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);

  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target;
}

/** When a term starting now ends — the 12 months bundled with the hardware. */
export function termEndFromPurchase(purchasedAt: Date): Date {
  return addMonths(purchasedAt, BUNDLED_MONTHS);
}

/**
 * Where a renewed term ends.
 *
 * Extends from the later of now and the existing end, so renewing early adds a
 * year rather than throwing away the time already paid for. This is the rule the
 * M-Pesa callback has always used for subscriptions; it moves here unchanged so
 * both paths share one implementation.
 */
export function renewedTermEnd(
  currentEnd: string | Date | null | undefined,
  now: Date = new Date(),
): Date {
  const existing = currentEnd ? new Date(currentEnd) : null;
  const base =
    existing && Number.isFinite(existing.getTime()) && existing.getTime() > now.getTime()
      ? existing
      : now;
  return addMonths(base, RENEWAL_MONTHS);
}
