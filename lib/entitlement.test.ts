import { describe, it, expect } from "vitest";
import {
  canPublishPage,
  publishBlockedReason,
  createBlockedReason,
  canCreateProfile,
  maxProfiles,
  publicPageState,
  publishSlots,
  usedSlots,
  freeSlots,
  isEntitlementError,
  isUnpublishedPageError,
  type PageEntitlementRow,
} from "./entitlement";
import { MAX_PROFILES_PER_ACCOUNT } from "./pricing";
import type { IdentityRow } from "./identity";

const NOW = new Date("2026-09-02T00:00:00.000Z");

/** A live identity: claimed, not disabled, well inside its term. */
function identity(over: Partial<IdentityRow> = {}): IdentityRow {
  return {
    id: over.id ?? `tag-${Math.random().toString(36).slice(2, 8)}`,
    account_id: "acct-1",
    status: "assigned",
    term_end: "2027-06-01T00:00:00.000Z",
    ...over,
  };
}

function page(over: Partial<PageEntitlementRow> = {}): PageEntitlementRow {
  return {
    id: over.id ?? `page-${Math.random().toString(36).slice(2, 8)}`,
    status: "draft",
    entitlement_grandfathered: false,
    created_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("publish slots", () => {
  it("counts one slot per live identity", () => {
    expect(publishSlots([identity(), identity()], NOW)).toBe(2);
  });

  /**
   * A disabled card is not billed (D-018), so it cannot be buying a slot
   * either. Switching a card off must not silently keep a page alive.
   */
  it("ignores switched-off and unclaimed devices", () => {
    expect(
      publishSlots([identity({ status: "disabled" }), identity({ account_id: null })], NOW),
    ).toBe(0);
  });

  /**
   * The grace window exists so a lapsed card keeps working while the owner
   * notices (D-018). A page going dark before the card does would defeat that.
   */
  it("still counts an identity inside its grace window", () => {
    expect(publishSlots([identity({ term_end: "2026-08-28T00:00:00.000Z" })], NOW)).toBe(1);
  });

  it("stops counting once grace has run out", () => {
    expect(publishSlots([identity({ term_end: "2026-07-01T00:00:00.000Z" })], NOW)).toBe(0);
  });

  /**
   * A missing term fails OPEN, matching identity_is_live() in 0015. The safe
   * failure is serving a customer who has paid, not darkening a card in
   * someone's hand over a timestamp that was never written.
   */
  it("treats an identity with no recorded term as live", () => {
    expect(publishSlots([identity({ term_end: null })], NOW)).toBe(1);
  });

  it("counts spent slots, ignoring grandfathered pages", () => {
    const pages = [
      page({ id: "a", status: "published" }),
      page({ id: "b", status: "published", entitlement_grandfathered: true }),
      page({ id: "c", status: "draft" }),
    ];
    expect(usedSlots(pages)).toBe(1);
    expect(freeSlots(pages, [identity(), identity()], NOW)).toBe(1);
  });
});

describe("canPublishPage — the entitlement rule", () => {
  /**
   * The commercial heart of D-021. Without a paid identity a profile is a
   * draft, and no amount of pressing Publish changes that.
   */
  it("refuses a draft on an account that owns nothing", () => {
    const p = page();
    expect(canPublishPage(p, [p], [], NOW)).toBe(false);
    expect(publishBlockedReason(p, [p], [], NOW)).toMatch(/not live yet/i);
  });

  it("allows a draft once one identity is live", () => {
    const p = page();
    expect(canPublishPage(p, [p], [identity()], NOW)).toBe(true);
    expect(publishBlockedReason(p, [p], [identity()], NOW)).toBeNull();
  });

  /** One identity, one publishable profile. A second needs a second card. */
  it("refuses a second page while the only slot is spent", () => {
    const live = page({ id: "a", status: "published" });
    const draft = page({ id: "b" });
    const pages = [live, draft];

    expect(canPublishPage(draft, pages, [identity()], NOW)).toBe(false);
    expect(publishBlockedReason(draft, pages, [identity()], NOW)).toMatch(/add another/i);
  });

  it("allows it once a second identity is bought", () => {
    const pages = [page({ id: "a", status: "published" }), page({ id: "b" })];
    expect(canPublishPage(pages[1], pages, [identity(), identity()], NOW)).toBe(true);
  });

  /**
   * Re-publishing something already live must always work. It holds a slot it
   * has already been granted, and refusing would strand an owner mid-edit with
   * a stale version of their page on the internet.
   */
  it("always allows re-publishing a page that is already live", () => {
    const live = page({ id: "a", status: "published" });
    expect(canPublishPage(live, [live], [], NOW)).toBe(true);
  });

  /**
   * The slot count is per account, not per page, so an identity lapsing takes
   * away the newest page rather than an arbitrary one.
   */
  it("refuses a new page when every identity has lapsed", () => {
    const draft = page({ id: "b" });
    const pages = [page({ id: "a", status: "published" }), draft];
    const lapsed = [identity({ term_end: "2026-01-01T00:00:00.000Z" })];
    expect(canPublishPage(draft, pages, lapsed, NOW)).toBe(false);
  });

  it("refuses an unknown page rather than assuming", () => {
    expect(canPublishPage(null, [], [identity()], NOW)).toBe(false);
    expect(canPublishPage(undefined, [], [identity()], NOW)).toBe(false);
  });
});

/**
 * GRANDFATHERING — the requirement that nobody already live is broken.
 *
 * These are the tests that matter most in this sprint. An existing customer
 * whose page goes dark because we changed our pricing model has been actively
 * harmed, and the migration's backfill plus this flag is the whole of what
 * stands between them and that.
 */
describe("grandfathering", () => {
  it("publishes with zero identities", () => {
    const gf = page({ id: "old", entitlement_grandfathered: true });
    expect(canPublishPage(gf, [gf], [], NOW)).toBe(true);
    expect(publishBlockedReason(gf, [gf], [], NOW)).toBeNull();
  });

  it("stays live when the account owns nothing at all", () => {
    const gf = page({ id: "old", status: "published", entitlement_grandfathered: true });
    expect(publicPageState(gf, [gf], [], NOW)).toBe("live");
  });

  it("stays live when every identity has lapsed", () => {
    const gf = page({ id: "old", status: "published", entitlement_grandfathered: true });
    const lapsed = [identity({ term_end: "2025-01-01T00:00:00.000Z" })];
    expect(publicPageState(gf, [gf], lapsed, NOW)).toBe("live");
  });

  /** Unpublishing and republishing must not cost them their exemption. */
  it("survives an unpublish and republish", () => {
    const gf = page({ id: "old", status: "draft", entitlement_grandfathered: true });
    expect(canPublishPage(gf, [gf], [], NOW)).toBe(true);
  });

  /**
   * Per page, not per account. Otherwise grandfathering quietly becomes an
   * unlimited free tier for every account that existed before the cutover.
   */
  it("does not extend to a new page on the same account", () => {
    const gf = page({ id: "old", status: "published", entitlement_grandfathered: true });
    const fresh = page({ id: "new" });
    expect(canPublishPage(fresh, [gf, fresh], [], NOW)).toBe(false);
  });

  /** And it must never consume a slot the customer has actually paid for. */
  it("leaves paid slots free for new pages", () => {
    const gf = page({ id: "old", status: "published", entitlement_grandfathered: true });
    const fresh = page({ id: "new" });
    expect(canPublishPage(fresh, [gf, fresh], [identity()], NOW)).toBe(true);
  });

  it("adds its own allowance so an existing customer is never over the limit", () => {
    const gf = page({ id: "old", status: "published", entitlement_grandfathered: true });
    expect(maxProfiles([gf], [], NOW)).toBe(2);
    expect(canCreateProfile([gf], [], NOW)).toBe(true);
  });
});

describe("publicPageState", () => {
  it("calls a draft a draft", () => {
    const p = page();
    expect(publicPageState(p, [p], [identity()], NOW)).toBe("draft");
  });

  it("calls an entitled published page live", () => {
    const p = page({ status: "published" });
    expect(publicPageState(p, [p], [identity()], NOW)).toBe("live");
  });

  /**
   * "Inactive" is a different state from "draft" and must stay so. A draft has
   * never been public; an inactive page was, and stopped because the account
   * stopped paying. Merging them would tell an owner whose card lapsed that
   * their page was never finished.
   */
  it("calls a published page with no slot inactive, not a draft", () => {
    const p = page({ status: "published" });
    expect(publicPageState(p, [p], [], NOW)).toBe("inactive");
  });

  /**
   * Deterministic ordering. When an account with two cards lets one lapse,
   * WHICH page goes dark must be a fact rather than a race, and the oldest
   * published one wins because it is the one most likely to be printed on
   * something. Mirrors page_is_live() in 0019.
   */
  it("keeps the oldest published page live and drops the newest", () => {
    const older = page({
      id: "a",
      status: "published",
      published_at: "2026-01-01T00:00:00.000Z",
    });
    const newer = page({
      id: "b",
      status: "published",
      published_at: "2026-06-01T00:00:00.000Z",
    });
    const pages = [newer, older];
    const one = [identity()];

    expect(publicPageState(older, pages, one, NOW)).toBe("live");
    expect(publicPageState(newer, pages, one, NOW)).toBe("inactive");
  });

  it("keeps both live while both slots are paid for", () => {
    const a = page({ id: "a", status: "published", published_at: "2026-01-01T00:00:00.000Z" });
    const b = page({ id: "b", status: "published", published_at: "2026-06-01T00:00:00.000Z" });
    const two = [identity(), identity()];
    expect(publicPageState(a, [a, b], two, NOW)).toBe("live");
    expect(publicPageState(b, [a, b], two, NOW)).toBe("live");
  });
});

describe("how many profiles an account may hold", () => {
  /** A new account gets exactly one draft: the page it builds before buying. */
  it("gives an account that owns nothing one profile", () => {
    expect(maxProfiles([], [], NOW)).toBe(1);
    expect(canCreateProfile([], [], NOW)).toBe(true);
    expect(canCreateProfile([page()], [], NOW)).toBe(false);
  });

  it("gives one more per identity", () => {
    expect(maxProfiles([], [identity(), identity(), identity()], NOW)).toBe(3);
  });

  /**
   * Phrased as needing a card, not as hitting a limit. An owner who wants a
   * second profile wants a second card, and saying so is both true and more
   * useful than quoting them a number.
   */
  it("explains a refusal by naming the fix", () => {
    const reason = createBlockedReason([page()], [], NOW);
    expect(reason).toMatch(/own card or stand/i);
    expect(reason).not.toMatch(/limit/i);
  });

  /** The anti-abuse ceiling still applies above all of it (D-018). */
  it("never exceeds the abuse ceiling however many devices are owned", () => {
    const many = Array.from({ length: 200 }, () => identity());
    expect(maxProfiles([], many, NOW)).toBe(MAX_PROFILES_PER_ACCOUNT);
  });

  it("says so plainly at the ceiling", () => {
    const pages = Array.from({ length: MAX_PROFILES_PER_ACCOUNT }, (_, i) =>
      page({ id: `p${i}` }),
    );
    const many = Array.from({ length: 200 }, () => identity());
    expect(createBlockedReason(pages, many, NOW)).toMatch(
      new RegExp(`${MAX_PROFILES_PER_ACCOUNT} profiles`),
    );
  });
});

/**
 * The RPCs raise stable machine-readable codes rather than sentences, so the UI
 * can react without matching on prose that someone will improve one day.
 */
describe("database error codes", () => {
  it("recognises the publish refusal from 0019", () => {
    expect(isEntitlementError("insufficient_entitlement")).toBe(true);
    expect(
      isEntitlementError('new row violates ... raise exception "insufficient_entitlement"'),
    ).toBe(true);
    expect(isEntitlementError("page not found")).toBe(false);
    expect(isEntitlementError(null)).toBe(false);
  });

  it("recognises the claim refusal from 0019", () => {
    expect(isUnpublishedPageError("page_not_published")).toBe(true);
    expect(isUnpublishedPageError("tag already claimed")).toBe(false);
  });
});
