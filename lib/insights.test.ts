import { describe, it, expect } from "vitest";
import {
  computeInsights,
  emptyReason,
  THRESHOLDS,
  type InsightInputs,
} from "./insights";

const NOW = new Date("2026-08-15T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function inputs(over: Partial<InsightInputs> = {}): InsightInputs {
  return {
    days: 30,
    pages: [],
    actions: [],
    devices: [],
    leads: { new_count: 0, stale_new_count: 0, oldest_new_at: null },
    dismissed: [],
    ...over,
  };
}

const page = (over: Partial<InsightInputs["pages"][number]> = {}) => ({
  id: "p1",
  slug: "java-house",
  title: "Java House",
  status: "published",
  is_active: true,
  lead_form_enabled: false,
  opens: 100,
  clicks: 40,
  confirmed: 5,
  published_action_count: 3,
  dead_action_count: 0,
  ...over,
});

const action = (over: Partial<InsightInputs["actions"][number]> = {}) => ({
  page_id: "p1",
  link_id: "l1",
  label: "WhatsApp",
  type: "whatsapp",
  sort_order: 0,
  clicks: 0,
  ...over,
});

const device = (over: Partial<InsightInputs["devices"][number]> = {}) => ({
  id: "d1",
  label: "Till card",
  token: "abcdef123456",
  status: "assigned",
  claimed_at: daysAgo(60),
  smart_page_id: "p1",
  taps: 10,
  ...over,
});

const keys = (list: { key: string }[]) => list.map((i) => i.key);
const kinds = (list: { kind: string }[]) => list.map((i) => i.kind);

describe("action-order rule", () => {
  /** CLAUDE.md §14's own example, computed rather than asserted. */
  it("flags a lower action that clearly outperforms one above it", () => {
    const result = computeInsights(
      inputs({
        pages: [page()],
        actions: [
          action({ link_id: "l1", label: "Instagram", sort_order: 0, clicks: 10 }),
          action({ link_id: "l2", label: "WhatsApp", sort_order: 1, clicks: 40 }),
        ],
      }),
      NOW,
    );
    const found = result.find((i) => i.kind === "action-order")!;
    expect(found.title).toContain("WhatsApp");
    expect(found.evidence.join(" ")).toContain("40 clicks");
    expect(found.evidence.join(" ")).toContain("10 clicks");
    expect(found.action?.href).toContain("/dashboard/profiles/p1/edit");
  });

  /** Rule 1: never speak from noise. */
  it("stays silent below the minimum click volume", () => {
    const result = computeInsights(
      inputs({
        pages: [page()],
        actions: [
          action({ link_id: "l1", sort_order: 0, clicks: 1 }),
          action({ link_id: "l2", sort_order: 1, clicks: THRESHOLDS.actionOrderMinClicks - 1 }),
        ],
      }),
      NOW,
    );
    expect(kinds(result)).not.toContain("action-order");
  });

  it("stays silent when the gap is not decisive", () => {
    const result = computeInsights(
      inputs({
        pages: [page()],
        actions: [
          action({ link_id: "l1", sort_order: 0, clicks: 30 }),
          action({ link_id: "l2", sort_order: 1, clicks: 35 }), // < 1.5x
        ],
      }),
      NOW,
    );
    expect(kinds(result)).not.toContain("action-order");
  });

  it("never suggests moving something that is already on top", () => {
    const result = computeInsights(
      inputs({
        pages: [page()],
        actions: [
          action({ link_id: "l1", sort_order: 0, clicks: 90 }),
          action({ link_id: "l2", sort_order: 1, clicks: 5 }),
        ],
      }),
      NOW,
    );
    expect(kinds(result)).not.toContain("action-order");
  });

  it("reports one finding per page, not every pair", () => {
    const result = computeInsights(
      inputs({
        pages: [page()],
        actions: [
          action({ link_id: "l1", sort_order: 0, clicks: 5 }),
          action({ link_id: "l2", sort_order: 1, clicks: 6 }),
          action({ link_id: "l3", sort_order: 2, clicks: 80 }),
        ],
      }),
      NOW,
    );
    expect(result.filter((i) => i.kind === "action-order")).toHaveLength(1);
  });
});

describe("dead-action and no-actions rules", () => {
  /** One dead button is already a broken promise — no volume threshold. */
  it("flags published buttons with no destination", () => {
    const result = computeInsights(
      inputs({ pages: [page({ dead_action_count: 2 })] }),
      NOW,
    );
    const found = result.find((i) => i.kind === "dead-action")!;
    expect(found.severity).toBe("high");
    expect(found.title).toContain("2 buttons");
  });

  it("flags a live page with nothing to do on it", () => {
    const result = computeInsights(
      inputs({ pages: [page({ published_action_count: 0 })] }),
      NOW,
    );
    expect(kinds(result)).toContain("no-actions");
  });

  it("ignores drafts, which the public cannot see", () => {
    const result = computeInsights(
      inputs({ pages: [page({ status: "draft", dead_action_count: 3, published_action_count: 0 })] }),
      NOW,
    );
    expect(kinds(result)).not.toContain("dead-action");
    expect(kinds(result)).not.toContain("no-actions");
  });
});

describe("traffic-no-clicks rule", () => {
  it("flags real traffic that never clicks", () => {
    const result = computeInsights(
      inputs({ pages: [page({ opens: 120, clicks: 0 })] }),
      NOW,
    );
    const found = result.find((i) => i.kind === "traffic-no-clicks")!;
    expect(found.evidence).toContain("120 page opens");
  });

  it("stays silent on a quiet week", () => {
    const result = computeInsights(
      inputs({
        pages: [page({ opens: THRESHOLDS.trafficNoClicksMinOpens - 1, clicks: 0 })],
      }),
      NOW,
    );
    expect(kinds(result)).not.toContain("traffic-no-clicks");
  });

  it("defers to the clearer finding when there are no actions at all", () => {
    const result = computeInsights(
      inputs({ pages: [page({ opens: 200, clicks: 0, published_action_count: 0 })] }),
      NOW,
    );
    expect(kinds(result)).toContain("no-actions");
    expect(kinds(result)).not.toContain("traffic-no-clicks");
  });
});

describe("idle-card rule", () => {
  /**
   * The mockup's "reception stand is underperforming", made honest: it can only
   * fire when other cards ARE being tapped, so a quiet month for the whole
   * business never gets blamed on one card.
   */
  it("flags a silent card while others are busy", () => {
    const result = computeInsights(
      inputs({
        pages: [page()],
        devices: [
          device({ id: "d1", label: "Till card", taps: 40 }),
          device({ id: "d2", label: "Reception stand", taps: 0 }),
        ],
      }),
      NOW,
    );
    const found = result.find((i) => i.kind === "idle-card")!;
    expect(found.title).toContain("Reception stand");
    expect(found.evidence.join(" ")).toContain("40 taps across your other cards");
  });

  it("blames nothing when the whole account is quiet", () => {
    const result = computeInsights(
      inputs({
        devices: [device({ id: "d1", taps: 2 }), device({ id: "d2", taps: 0 })],
      }),
      NOW,
    );
    expect(kinds(result)).not.toContain("idle-card");
  });

  it("gives a newly claimed card time before judging it", () => {
    const result = computeInsights(
      inputs({
        devices: [
          device({ id: "d1", taps: 40 }),
          device({ id: "d2", taps: 0, claimed_at: daysAgo(3) }),
        ],
      }),
      NOW,
    );
    expect(kinds(result)).not.toContain("idle-card");
  });

  it("ignores disabled and unassigned cards", () => {
    const result = computeInsights(
      inputs({
        devices: [
          device({ id: "d1", taps: 40 }),
          device({ id: "d2", taps: 0, status: "disabled" }),
          device({ id: "d3", taps: 0, status: "unassigned", smart_page_id: null }),
        ],
      }),
      NOW,
    );
    expect(kinds(result)).not.toContain("idle-card");
  });
});

describe("stale-leads rule", () => {
  it("flags enquiries left waiting", () => {
    const result = computeInsights(
      inputs({
        leads: { new_count: 5, stale_new_count: 3, oldest_new_at: daysAgo(21) },
      }),
      NOW,
    );
    const found = result.find((i) => i.kind === "stale-leads")!;
    expect(found.severity).toBe("high");
    expect(found.title).toContain("3 leads");
    expect(found.evidence.join(" ")).toContain("21 days old");
    expect(found.action?.href).toContain("status=new");
  });

  it("says nothing when leads are being handled", () => {
    const result = computeInsights(
      inputs({ leads: { new_count: 4, stale_new_count: 0, oldest_new_at: daysAgo(1) } }),
      NOW,
    );
    expect(kinds(result)).not.toContain("stale-leads");
  });
});

describe("panel behaviour", () => {
  it("hides dismissed findings", () => {
    const base = inputs({ pages: [page({ dead_action_count: 1 })] });
    const before = computeInsights(base, NOW);
    expect(before.length).toBeGreaterThan(0);

    const after = computeInsights({ ...base, dismissed: keys(before) }, NOW);
    expect(after).toHaveLength(0);
  });

  it("keeps keys stable so a dismissal sticks across recomputation", () => {
    const base = inputs({ pages: [page({ dead_action_count: 1 })] });
    expect(keys(computeInsights(base, NOW))).toEqual(keys(computeInsights(base, NOW)));
  });

  it("puts the most urgent findings first", () => {
    const result = computeInsights(
      inputs({
        pages: [page({ opens: 200, clicks: 0 }), page({ id: "p2", slug: "b", dead_action_count: 1 })],
        leads: { new_count: 2, stale_new_count: 2, oldest_new_at: daysAgo(30) },
      }),
      NOW,
    );
    expect(result[0].severity).toBe("high");
  });

  it("gives every finding evidence and a title", () => {
    const result = computeInsights(
      inputs({
        pages: [page({ opens: 200, clicks: 0 }), page({ id: "p2", slug: "b", dead_action_count: 1 })],
        devices: [device({ id: "d1", taps: 40 }), device({ id: "d2", taps: 0 })],
        leads: { new_count: 1, stale_new_count: 1, oldest_new_at: daysAgo(10) },
      }),
      NOW,
    );
    expect(result.length).toBeGreaterThan(2);
    for (const insight of result) {
      expect(insight.title.length).toBeGreaterThan(0);
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.evidence.every((e) => e.length > 0)).toBe(true);
    }
  });

  it("returns nothing for a healthy account", () => {
    expect(computeInsights(inputs({ pages: [page()] }), NOW)).toHaveLength(0);
  });
});

describe("emptyReason", () => {
  it("distinguishes too-little-data from nothing-wrong", () => {
    expect(emptyReason(inputs())).toMatch(/Publish a profile/);
    expect(emptyReason(inputs({ pages: [page({ opens: 2 })] }))).toMatch(/Not enough activity/);
    expect(emptyReason(inputs({ pages: [page({ opens: 500 })] }))).toMatch(/Nothing needs/);
  });
});
