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
 * One-time hardware price. **Includes the first 12 months of service** — this
 * is why buying a device starts a term rather than merely shipping an object.
 */
export const HARDWARE_PRICE_KES: Record<DeviceKind, number> = {
  card: 1_500,
  stand: 2_000,
};

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
