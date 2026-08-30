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

/** Packaging, not count-gates. Commercial is sales-led and set by staff. */
export type Segment = "professional" | "business" | "commercial";

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
 * Not a plan gate — an abuse guard. Profiles are free under this model, so the
 * only reason to cap them is to stop one account minting thousands. Deliberately
 * far above any real business's usage, and never advertised as a limit.
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
 * The Commercial segment is *packaged* as "advanced" but is not sold a report
 * section that does not exist — §15 forbids claiming capability we lack.
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
  /** What the segment unlocks once the account holds an active identity. */
  entitlements: Entitlements;
  /** Devices this segment is sold. */
  deviceKinds: DeviceKind[];
  /** Commercial has no public checkout — it is quoted. */
  salesLed: boolean;
};

export const SEGMENTS: Record<Segment, SegmentDefinition> = {
  professional: {
    code: "professional",
    name: "Professional",
    audience: "Individuals with one card",
    entitlements: {
      analytics: "basic",
      leadCapture: true,
      customBranding: false,
      teamManagement: false,
      support: "standard",
    },
    deviceKinds: ["card"],
    salesLed: false,
  },
  business: {
    code: "business",
    name: "Business",
    audience: "SMEs running several cards and stands",
    entitlements: {
      analytics: "full",
      leadCapture: true,
      customBranding: true,
      teamManagement: false,
      support: "business",
    },
    deviceKinds: ["card", "stand"],
    salesLed: false,
  },
  commercial: {
    code: "commercial",
    name: "Commercial",
    audience: "Organisations with multiple locations and teams",
    entitlements: {
      analytics: "full",
      leadCapture: true,
      customBranding: true,
      teamManagement: true,
      support: "priority",
    },
    deviceKinds: ["card", "stand"],
    salesLed: true,
  },
};

export const SEGMENT_ORDER: Segment[] = ["professional", "business", "commercial"];

/**
 * What an account with **no active identity** gets.
 *
 * Signing up and building a profile is free, and the profile stays live — that
 * is the whole funnel (a person builds something, then buys the card that makes
 * it tappable). What free does not include is the two capabilities worth paying
 * for: enquiry capture and the full analytics report.
 */
export const FREE_ENTITLEMENTS: Entitlements = {
  analytics: "basic",
  leadCapture: false,
  customBranding: false,
  teamManagement: false,
  support: "standard",
};

/**
 * The entitlements that actually apply right now.
 *
 * Segment describes what was *bought*; the active-identity count decides what is
 * still *owned*. An account whose every device has lapsed falls back to free —
 * the same "effective vs purchased" split that `effectivePlan` established in
 * UI-9, moved down to identity grain.
 */
export function entitlementsFor(
  segment: Segment | null | undefined,
  activeIdentities: number,
): Entitlements {
  if (activeIdentities <= 0) return FREE_ENTITLEMENTS;
  return (SEGMENTS[segment ?? "professional"] ?? SEGMENTS.professional).entitlements;
}

export function segmentFor(code: string | null | undefined): SegmentDefinition {
  return SEGMENTS[(code as Segment) ?? "professional"] ?? SEGMENTS.professional;
}

/**
 * The segment an account's holdings imply, used when provisioning a purchase.
 *
 * Commercial is never inferred — it is a commercial relationship with negotiated
 * terms, so it is only ever set deliberately by staff and is preserved here.
 */
export function suggestedSegment(
  identityCount: number,
  current?: Segment | null,
): Segment {
  if (current === "commercial") return "commercial";
  return identityCount > 1 ? "business" : "professional";
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
