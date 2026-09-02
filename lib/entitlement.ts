/**
 * Publish entitlement — who may put a profile on the internet (D-021, D-022).
 *
 * A profile is built for nothing and published against a paid identity. This
 * file is the TypeScript half of that rule; `0019_publish_entitlement.sql` is
 * the SQL half, and the two must agree. The split is the one D-019 established
 * for order transitions and D-020 for the ops board: the database GUARANTEES the
 * rule cannot be bypassed, this file decides what the UI offers and why, and
 * neither restates the other's job.
 *
 * Nothing here queries. Every function takes rows and a clock, so the whole of
 * what the product will and will not publish is testable without a database.
 */

import { activeIdentityCount, type IdentityRow } from "./identity";
import { MAX_PROFILES_PER_ACCOUNT } from "./pricing";

export type PublishStatus = "draft" | "published";

/** The columns every entitlement decision needs from `smart_pages`. */
export type PageEntitlementRow = {
  id: string;
  status?: PublishStatus | string | null;
  /**
   * True for pages that were already live when 0019 ran. Such a page publishes
   * and resolves without consuming a slot, permanently (D-023).
   */
  entitlement_grandfathered?: boolean | null;
  published_at?: string | null;
  created_at?: string | null;
};

export function isPublished(page: PageEntitlementRow | null | undefined): boolean {
  return page?.status === "published";
}

export function isGrandfathered(page: PageEntitlementRow | null | undefined): boolean {
  return page?.entitlement_grandfathered === true;
}

/**
 * Slots available to this account — one per live identity.
 *
 * Live means claimed, not switched off, and inside its term plus grace. It is
 * `activeIdentityCount` unchanged, named again here because "how many devices
 * still work" and "how many pages may be live" are different questions that
 * happen to share an answer, and a later change to one should not silently move
 * the other.
 */
export function publishSlots(
  identities: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): number {
  return activeIdentityCount(identities, now);
}

/**
 * Slots already spent.
 *
 * Grandfathered pages are excluded: they carry their own slot and must never
 * crowd out a page the customer has actually paid for.
 */
export function usedSlots(pages: PageEntitlementRow[] | null | undefined): number {
  return (pages ?? []).filter((p) => isPublished(p) && !isGrandfathered(p)).length;
}

export function freeSlots(
  pages: PageEntitlementRow[] | null | undefined,
  identities: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): number {
  return Math.max(0, publishSlots(identities, now) - usedSlots(pages));
}

/**
 * May this page be published?
 *
 * Mirrors `page_publish_allowed()` in 0019 line for line, including the two
 * exemptions: a grandfathered page always may, and a page that is already
 * published always may, because re-publishing holds a slot it has already been
 * granted and refusing would strand an owner mid-edit.
 */
export function canPublishPage(
  page: PageEntitlementRow | null | undefined,
  pages: PageEntitlementRow[] | null | undefined,
  identities: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!page) return false;
  if (isGrandfathered(page)) return true;
  if (isPublished(page)) return true;

  const others = (pages ?? []).filter((p) => p.id !== page.id);
  return usedSlots(others) < publishSlots(identities, now);
}

/**
 * Why publishing is refused, in the owner's words, or null if it is allowed.
 *
 * One function so the builder and the server action cannot disagree — the UI
 * uses it to write the banner, the action re-checks it against current state,
 * and the database refuses independently of both.
 *
 * The wording distinguishes the two ways to arrive here, because they need
 * different next steps: an account that has never bought anything is buying its
 * first card, and an account whose slots are all spent is buying a second.
 */
export function publishBlockedReason(
  page: PageEntitlementRow | null | undefined,
  pages: PageEntitlementRow[] | null | undefined,
  identities: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): string | null {
  if (canPublishPage(page, pages, identities, now)) return null;

  const slots = publishSlots(identities, now);
  if (slots === 0) {
    return "This profile is not live yet. Activate it with a Smart Card or Smart Stand to publish it.";
  }
  return `All ${slots} of your ${
    slots === 1 ? "cards is" : "cards are"
  } already powering a live profile. Add another to publish this one too.`;
}

/**
 * How many profiles this account may hold at once.
 *
 * One identity, one profile, with a floor of one so that an account owning
 * nothing still gets the draft a new customer builds before deciding to buy.
 *
 * Grandfathered pages are added ON TOP of that floor rather than counted into
 * it. Folding them in would mean a customer who was live before the cutover
 * could not start a second profile at all, while someone signing up this
 * morning could — punishing them for having been here first, which is the exact
 * opposite of what grandfathering is for.
 *
 * `MAX_PROFILES_PER_ACCOUNT` remains what it has always been: an anti-abuse
 * ceiling, not a plan gate, and never advertised as a limit.
 */
export function maxProfiles(
  pages: PageEntitlementRow[] | null | undefined,
  identities: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): number {
  const grandfathered = (pages ?? []).filter(isGrandfathered).length;
  const allowed = Math.max(1, publishSlots(identities, now)) + grandfathered;
  return Math.min(allowed, MAX_PROFILES_PER_ACCOUNT);
}

export function canCreateProfile(
  pages: PageEntitlementRow[] | null | undefined,
  identities: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): boolean {
  return (pages ?? []).length < maxProfiles(pages, identities, now);
}

/**
 * Why another profile is refused, or null if it is allowed.
 *
 * Deliberately not phrased as a limit being hit. An owner who wants a second
 * profile wants a second card, and saying so is both true and more useful than
 * quoting them a number.
 */
export function createBlockedReason(
  pages: PageEntitlementRow[] | null | undefined,
  identities: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): string | null {
  if (canCreateProfile(pages, identities, now)) return null;

  if ((pages ?? []).length >= MAX_PROFILES_PER_ACCOUNT) {
    return `You have reached ${MAX_PROFILES_PER_ACCOUNT} profiles. Talk to us if you genuinely need more.`;
  }
  return "Each profile needs its own card or stand. Add one and you can build another profile.";
}

/**
 * What the public would see for this page right now.
 *
 * Mirrors `page_is_live()` in 0019, including its ordering rule: when an account
 * lets an identity lapse, the page that goes dark is the most recently published
 * one, because the oldest is the one most likely to be printed on something.
 *
 *   draft    — never been public. The slug 404s.
 *   live     — resolving normally.
 *   inactive — published, but the account no longer owns a slot for it. The slug
 *              serves the branded "not active right now" screen (D-018), because
 *              the reader is usually the cardholder's customer.
 */
export type PublicPageState = "draft" | "live" | "inactive";

export function publicPageState(
  page: PageEntitlementRow | null | undefined,
  pages: PageEntitlementRow[] | null | undefined,
  identities: IdentityRow[] | null | undefined,
  now: Date = new Date(),
): PublicPageState {
  if (!page) return "draft";
  if (isGrandfathered(page)) return "live";
  if (!isPublished(page)) return "draft";

  const rank = publishRank(page, pages);
  return rank <= publishSlots(identities, now) ? "live" : "inactive";
}

/** 1-based position among the account's published, non-grandfathered pages. */
function publishRank(
  page: PageEntitlementRow,
  pages: PageEntitlementRow[] | null | undefined,
): number {
  const at = (p: PageEntitlementRow) => p.published_at ?? p.created_at ?? "";
  const mine = at(page);

  return (
    (pages ?? []).filter((p) => {
      if (!isPublished(p) || isGrandfathered(p)) return false;
      const theirs = at(p);
      if (theirs < mine) return true;
      return theirs === mine && p.id <= page.id;
    }).length || 1
  );
}

/**
 * Did the database refuse this on entitlement grounds?
 *
 * Postgres exceptions arrive as message strings, so the RPCs raise a stable
 * machine-readable code rather than a sentence. Matching on prose would break
 * the moment someone improved the wording.
 */
export function isEntitlementError(message: string | null | undefined): boolean {
  return (message ?? "").includes("insufficient_entitlement");
}

/** The claim path's equivalent: a card cannot be bound to a draft. */
export function isUnpublishedPageError(message: string | null | undefined): boolean {
  return (message ?? "").includes("page_not_published");
}
