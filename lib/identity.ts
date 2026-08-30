/**
 * Identity entitlements — the per-device replacement for per-account plans (D-018).
 *
 * This mirrors the shape `lib/plans.ts` established in UI-9, one level down.
 * That file separated three questions cleanly and the separation was the reason
 * the B13 expiry bug stayed fixed, so it is kept exactly:
 *
 *   identityState()      — what is true of this device right now
 *   activeIdentityCount()— how much the account still owns
 *   entitlementsFor()    — what that entitles them to (lib/pricing.ts)
 *
 * Nothing here queries. Every function takes rows and a clock, so the whole of
 * what the product will charge for is testable without a database.
 */

import {
  GRACE_DAYS,
  RENEWAL_WARNING_DAYS,
  RENEWAL_BATCH_WINDOW_DAYS,
  RENEWAL_PER_IDENTITY_KES,
  type DeviceKind,
} from "./pricing";

/** The columns every identity-aware query selects from `nfc_tags`. */
export type IdentityRow = {
  id: string;
  token?: string | null;
  kind?: DeviceKind | string | null;
  label?: string | null;
  status?: string | null;
  account_id?: string | null;
  smart_page_id?: string | null;
  term_start?: string | null;
  term_end?: string | null;
  claimed_at?: string | null;
};

export type IdentityState =
  /** Minted but nobody owns it — not a billing unit yet. */
  | "unclaimed"
  /** Switched off by its owner. Does not resolve, and is not billed. */
  | "disabled"
  /** Paid and well inside its term. */
  | "active"
  /** Paid, but the term ends within the warning window. */
  | "expiring"
  /** Term has ended; still resolving because it is inside the grace window. */
  | "grace"
  /** Term ended and grace ran out. The device has stopped resolving. */
  | "expired";

/** States in which the physical device still resolves. */
const LIVE_STATES: ReadonlySet<IdentityState> = new Set<IdentityState>([
  "active",
  "expiring",
  "grace",
]);

export function daysUntil(
  iso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

/**
 * Classify one identity.
 *
 * A missing `term_end` is treated as live, not expired. The safe failure is to
 * keep serving a customer who has paid rather than to darken a card in someone's
 * hand because a timestamp was never written — the same call `subscriptionState`
 * made for subscriptions, and the reason the 0015 backfill can be conservative.
 */
export function identityState(
  tag: IdentityRow | null | undefined,
  now: Date = new Date(),
): IdentityState {
  if (!tag) return "unclaimed";
  if (tag.status === "disabled") return "disabled";
  if (!tag.account_id) return "unclaimed";

  const remaining = daysUntil(tag.term_end, now);
  if (remaining === null) return "active";
  if (remaining > RENEWAL_WARNING_DAYS) return "active";
  if (remaining > 0) return "expiring";
  if (remaining > -GRACE_DAYS) return "grace";
  return "expired";
}

/** Does this device still resolve when tapped? */
export function isLive(state: IdentityState): boolean {
  return LIVE_STATES.has(state);
}

/**
 * Identities that count as owned today.
 *
 * Drives entitlements: an account whose every device has lapsed falls back to
 * free, exactly as a lapsed plan did before.
 */
export function activeIdentityCount(
  tags: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): number {
  return (tags ?? []).filter((t) => isLive(identityState(t, now))).length;
}

/**
 * Identities that are billable — claimed and not switched off.
 *
 * Includes lapsed ones, because a lapsed device is precisely what a renewal
 * payment brings back. Excludes disabled ones: an owner who switched a card off
 * should not be charged to keep it off.
 */
export function billableIdentities(
  tags: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): IdentityRow[] {
  return (tags ?? []).filter((t) => {
    const state = identityState(t, now);
    return state !== "unclaimed" && state !== "disabled";
  });
}

/**
 * Identities due for renewal within `withinDays`.
 *
 * This is what "consolidated renewal" means here. Terms are stored per identity
 * so that the twelve months bundled with a device are the twelve months actually
 * delivered; the consolidation is a billing *action* over everything falling due
 * in one window, not a shared date that would have to rob one device to align
 * another.
 */
export function identitiesDueWithin(
  tags: IdentityRow[] | null | undefined,
  withinDays: number = RENEWAL_BATCH_WINDOW_DAYS,
  now: Date = new Date(),
): IdentityRow[] {
  return billableIdentities(tags, now).filter((t) => {
    const remaining = daysUntil(t.term_end, now);
    // No recorded term means nothing is owed yet — it cannot be "due".
    if (remaining === null) return false;
    return remaining <= withinDays;
  });
}

/** What renewing a given set of identities costs. */
export function renewalAmountKes(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count) * RENEWAL_PER_IDENTITY_KES;
}

/**
 * The account's next renewal date — the earliest term end among devices that
 * still count. Derived, never stored, so it cannot drift from the terms it
 * summarises.
 */
export function accountRenewalDate(
  tags: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): string | null {
  const ends = billableIdentities(tags, now)
    .map((t) => t.term_end)
    .filter((e): e is string => Boolean(e) && Number.isFinite(new Date(e as string).getTime()))
    .sort();
  return ends[0] ?? null;
}

export type BillingSummary = {
  /** Devices that still resolve. */
  active: number;
  /** Claimed, not disabled — what a full renewal would cover. */
  billable: number;
  /** Falling due inside the batch window, including already-lapsed ones. */
  due: IdentityRow[];
  dueAmountKes: number;
  /** Earliest upcoming term end across billable devices. */
  renewsOn: string | null;
  /** True once at least one device has stopped resolving. */
  hasLapsed: boolean;
};

export function billingSummary(
  tags: IdentityRow[] | null | undefined,
  now: Date = new Date(),
  withinDays: number = RENEWAL_BATCH_WINDOW_DAYS,
): BillingSummary {
  const due = identitiesDueWithin(tags, withinDays, now);
  return {
    active: activeIdentityCount(tags, now),
    billable: billableIdentities(tags, now).length,
    due,
    dueAmountKes: renewalAmountKes(due.length),
    renewsOn: accountRenewalDate(tags, now),
    hasLapsed: (tags ?? []).some((t) => identityState(t, now) === "expired"),
  };
}

export const IDENTITY_STATE_META: Record<
  IdentityState,
  { label: string; tone: "success" | "warning" | "danger" | "neutral"; description: string }
> = {
  active: {
    label: "Active",
    tone: "success",
    description: "Working normally",
  },
  expiring: {
    label: "Renewing soon",
    tone: "warning",
    description: "Still working — renew to avoid interruption",
  },
  grace: {
    label: "Overdue",
    tone: "warning",
    // Saying the card still works is the point: the owner has days, not hours.
    description: "Term ended. Still working during the grace period — renew now",
  },
  expired: {
    label: "Inactive",
    tone: "danger",
    description: "Stopped working. Renew to bring it back",
  },
  disabled: {
    label: "Switched off",
    tone: "neutral",
    description: "Turned off by you. Not billed",
  },
  unclaimed: {
    label: "Not set up",
    tone: "neutral",
    description: "Not linked to a profile yet",
  },
};
