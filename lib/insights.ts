/**
 * Insights — deterministic, explainable, and provable.
 *
 * There is no model here. Every finding is a rule applied to counts, and every
 * finding carries the counts it was derived from, so an owner can check the
 * reasoning and disagree with it. That is the point: CLAUDE.md §30.8 forbids
 * presenting hard-coded analysis as AI, and §16 forbids fabricating insight
 * from data that does not exist.
 *
 * Two rules govern the rules:
 *
 *   1. NEVER SPEAK FROM NOISE. Every threshold below has a minimum volume, so
 *      the product does not advise a business to rearrange its page on the
 *      strength of three clicks.
 *   2. EVERY CLAIM SHOWS ITS EVIDENCE. If a finding cannot state the numbers
 *      behind it and link to the screen that proves it, it is not shipped.
 */

export type InsightSeverity = "high" | "medium" | "low";

export type Insight = {
  /** Stable across recomputations, so a dismissal sticks. */
  key: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** The numbers this finding was derived from, shown verbatim in the UI. */
  evidence: string[];
  action?: { label: string; href: string };
};

export type InsightKind =
  | "action-order"
  | "dead-action"
  | "no-actions"
  | "traffic-no-clicks"
  | "idle-card"
  | "stale-leads";

export type InsightInputs = {
  days: number;
  pages: {
    id: string;
    slug: string;
    title: string | null;
    status: string;
    is_active: boolean;
    lead_form_enabled: boolean;
    opens: number;
    clicks: number;
    confirmed: number;
    published_action_count: number;
    dead_action_count: number;
  }[];
  actions: {
    page_id: string;
    link_id: string | null;
    label: string | null;
    type: string;
    sort_order: number;
    clicks: number;
  }[];
  devices: {
    id: string;
    label: string | null;
    token: string;
    status: string;
    claimed_at: string | null;
    smart_page_id: string | null;
    taps: number;
  }[];
  leads: {
    new_count: number;
    stale_new_count: number;
    oldest_new_at: string | null;
  };
  dismissed: string[];
};

/**
 * Minimum volumes. These are the difference between advice and superstition —
 * with small numbers, ordinary variation looks like a pattern.
 */
export const THRESHOLDS = {
  /** Clicks the lower action needs before its lead over a higher one means anything. */
  actionOrderMinClicks: 12,
  /** How much better it must do. 1.5× keeps near-ties out of the panel. */
  actionOrderRatio: 1.5,
  /** Page opens before "nobody clicks anything" is a finding rather than a quiet week. */
  trafficNoClicksMinOpens: 30,
  /** Account-wide card taps before one card's silence is comparable. */
  idleCardMinAccountTaps: 20,
  /** A card needs to have been in service this long before being called idle. */
  idleCardMinAgeDays: 14,
  /** Leads sitting untouched before follow-up is overdue. */
  staleLeadDays: 7,
} as const;

const pageName = (p: { title: string | null; slug: string }) => p.title || `/${p.slug}`;
const actionName = (a: { label: string | null; type: string }) => a.label || a.type;
const deviceName = (d: { label: string | null; token: string }) =>
  d.label || `Card ···${d.token.slice(-6)}`;

const SEVERITY_ORDER: Record<InsightSeverity, number> = { high: 0, medium: 1, low: 2 };

/**
 * Compute insights from facts. Pure — no I/O, no clock beyond `now`, so every
 * rule is testable in isolation.
 */
export function computeInsights(
  inputs: InsightInputs,
  now: Date = new Date(),
): Insight[] {
  const found: Insight[] = [];
  const pageById = new Map(inputs.pages.map((p) => [p.id, p]));

  // ---------------------------------------------------------------------
  // An action further down the page outperforms one above it.
  // CLAUDE.md §14's own example — computed, not asserted.
  // ---------------------------------------------------------------------
  for (const page of inputs.pages) {
    const actions = inputs.actions
      .filter((a) => a.page_id === page.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (actions.length < 2) continue;

    let best: { lower: (typeof actions)[number]; higher: (typeof actions)[number] } | null = null;
    for (let i = 1; i < actions.length; i++) {
      const lower = actions[i];
      if (lower.clicks < THRESHOLDS.actionOrderMinClicks) continue;
      for (let j = 0; j < i; j++) {
        const higher = actions[j];
        if (lower.clicks < higher.clicks * THRESHOLDS.actionOrderRatio) continue;
        // Report the single widest gap per page rather than every pair.
        const gap = lower.clicks - higher.clicks;
        const bestGap = best ? best.lower.clicks - best.higher.clicks : -1;
        if (gap > bestGap) best = { lower, higher };
      }
    }

    if (best) {
      found.push({
        key: `action-order:${page.id}:${best.lower.link_id ?? best.lower.sort_order}`,
        kind: "action-order",
        severity: "medium",
        title: `Move “${actionName(best.lower)}” higher on ${pageName(page)}`,
        detail: `It is getting more clicks than “${actionName(best.higher)}”, which sits above it. Customers are scrolling past your best action.`,
        evidence: [
          `“${actionName(best.lower)}” — ${best.lower.clicks} clicks, position ${best.lower.sort_order + 1}`,
          `“${actionName(best.higher)}” — ${best.higher.clicks} clicks, position ${best.higher.sort_order + 1}`,
          `Last ${inputs.days} days`,
        ],
        action: { label: "Reorder actions", href: `/dashboard/profiles/${page.id}/edit` },
      });
    }
  }

  // ---------------------------------------------------------------------
  // Buttons that are live but go nowhere.
  // No volume threshold: one dead button is already a broken promise.
  // ---------------------------------------------------------------------
  for (const page of inputs.pages) {
    if (page.status !== "published") continue;

    if (page.dead_action_count > 0) {
      found.push({
        key: `dead-action:${page.id}`,
        kind: "dead-action",
        severity: "high",
        title: `${page.dead_action_count} button${page.dead_action_count === 1 ? "" : "s"} on ${pageName(page)} do${page.dead_action_count === 1 ? "es" : ""} nothing`,
        detail:
          "The action is published without a destination, so tapping it has no effect. Add the link or remove the button, then publish.",
        evidence: [
          `${page.dead_action_count} published action${page.dead_action_count === 1 ? "" : "s"} with no destination`,
          `Page is live at /${page.slug}`,
        ],
        action: { label: "Fix the page", href: `/dashboard/profiles/${page.id}/edit` },
      });
    }

    if (page.published_action_count === 0 && page.is_active) {
      found.push({
        key: `no-actions:${page.id}`,
        kind: "no-actions",
        severity: "high",
        title: `${pageName(page)} has no actions`,
        detail:
          "The page is live but there is nothing for a visitor to do. Add at least one action — WhatsApp and Google review are the usual first two.",
        evidence: [`Live at /${page.slug}`, "0 published actions"],
        action: { label: "Add an action", href: `/dashboard/profiles/${page.id}/edit` },
      });
    }
  }

  // ---------------------------------------------------------------------
  // People arrive and do nothing.
  // ---------------------------------------------------------------------
  for (const page of inputs.pages) {
    if (page.status !== "published") continue;
    if (page.opens < THRESHOLDS.trafficNoClicksMinOpens) continue;
    if (page.clicks > 0) continue;
    // A page with no actions is already covered by a clearer finding.
    if (page.published_action_count === 0) continue;

    found.push({
      key: `traffic-no-clicks:${page.id}`,
      kind: "traffic-no-clicks",
      severity: "medium",
      title: `${pageName(page)} gets visitors but no clicks`,
      detail:
        "People are opening the page and leaving without pressing anything. The actions may be unclear, or not what visitors came for.",
      evidence: [
        `${page.opens} page opens`,
        "0 button clicks",
        `Last ${inputs.days} days`,
      ],
      action: { label: "Review the page", href: `/dashboard/profiles/${page.id}/edit` },
    });
  }

  // ---------------------------------------------------------------------
  // A card in service that nobody taps — the mockup's "reception stand"
  // insight, made honest: it only fires when other cards ARE being tapped, so
  // a quiet month for the whole business never blames one card.
  // ---------------------------------------------------------------------
  const activeCards = inputs.devices.filter(
    (d) => d.status === "assigned" && d.smart_page_id,
  );
  const accountTaps = activeCards.reduce((sum, d) => sum + d.taps, 0);

  if (activeCards.length >= 2 && accountTaps >= THRESHOLDS.idleCardMinAccountTaps) {
    for (const card of activeCards) {
      if (card.taps > 0) continue;
      const ageDays = card.claimed_at
        ? (now.getTime() - new Date(card.claimed_at).getTime()) / 86_400_000
        : Infinity;
      if (ageDays < THRESHOLDS.idleCardMinAgeDays) continue;

      const page = card.smart_page_id ? pageById.get(card.smart_page_id) : undefined;
      found.push({
        key: `idle-card:${card.id}`,
        kind: "idle-card",
        severity: "medium",
        title: `${deviceName(card)} has not been tapped`,
        detail:
          "Your other cards are being used, so this one is probably in a spot customers do not reach — or it may not be encoded. Try moving it somewhere more visible.",
        evidence: [
          `0 taps in the last ${inputs.days} days`,
          `${accountTaps} taps across your other cards in the same period`,
          page ? `Points to ${pageName(page)}` : "Not linked to a profile",
        ],
        action: { label: "Check the card", href: "/dashboard/devices" },
      });
    }
  }

  // ---------------------------------------------------------------------
  // Leads going cold.
  // ---------------------------------------------------------------------
  if (inputs.leads.stale_new_count > 0) {
    const oldestDays = inputs.leads.oldest_new_at
      ? Math.floor(
          (now.getTime() - new Date(inputs.leads.oldest_new_at).getTime()) / 86_400_000,
        )
      : null;

    found.push({
      key: "stale-leads",
      kind: "stale-leads",
      severity: "high",
      title: `${inputs.leads.stale_new_count} lead${inputs.leads.stale_new_count === 1 ? "" : "s"} waiting for a reply`,
      detail:
        "These enquiries have sat untouched for over a week. Someone asked for your business and has not heard back.",
      evidence: [
        `${inputs.leads.stale_new_count} marked “new” for more than ${THRESHOLDS.staleLeadDays} days`,
        oldestDays !== null ? `Oldest is ${oldestDays} days old` : "",
        `${inputs.leads.new_count} new in total`,
      ].filter(Boolean),
      action: { label: "Open Customers", href: "/dashboard/customers?status=new" },
    });
  }

  const dismissed = new Set(inputs.dismissed ?? []);
  return found
    .filter((i) => !dismissed.has(i.key))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * Why the panel is empty. "No insights" reads as broken; saying whether we are
 * short of data or genuinely found nothing is the honest distinction.
 */
export function emptyReason(inputs: InsightInputs): string {
  const published = inputs.pages.filter((p) => p.status === "published");
  if (published.length === 0) {
    return "Publish a profile and insights will appear as visitors start using it.";
  }
  const totalOpens = inputs.pages.reduce((sum, p) => sum + p.opens, 0);
  if (totalOpens < THRESHOLDS.trafficNoClicksMinOpens) {
    return "Not enough activity yet to say anything useful. Insights need a bit more traffic before they mean something.";
  }
  return "Nothing needs your attention right now.";
}
