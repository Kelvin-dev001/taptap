/**
 * Is what customers see the same as the draft? (docs/mobile/PLAN.md §9 W6)
 *
 * A published profile serves a snapshot (0009). Saving changes only the draft,
 * so "Live" alone does not tell an owner whether their last edits are out
 * there. Both editors, and the app's Home, ask this instead of guessing from
 * whether something was typed since the screen opened — which is why the web's
 * "Unpublished changes" used to disappear after Save although nothing had gone
 * live.
 *
 * It compares what a customer would notice: text, images, actions and their
 * order, colours. Action ids are ignored (an action deleted and added back the
 * same is no change to a customer), as are empty values versus missing ones.
 * Pure, and shared with the app (lib/mobile-shared.json).
 */

import type { PageConfig, Theme } from "./profile";

/** One action as the comparison needs it; both the snapshot and an editor's rows fit. */
export type ComparableAction = {
  type: string;
  label?: string | null;
  value?: string | null;
  sort_order?: number;
  /** Absent in a snapshot, which only ever holds active actions. */
  is_active?: boolean;
};

export type ComparableContent = {
  title?: string | null;
  mode?: string | null;
  redirect_url?: string | null;
  config?: PageConfig | null;
  theme?: Theme | null;
  /** In display order, or carrying sort_order. */
  links?: ComparableAction[] | null;
};

/** Drops undefined, null and "" (recursively) and sorts keys, so equal content prints equally. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = canonical((value as Record<string, unknown>)[key]);
      if (v === undefined) continue;
      out[key] = v;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  if (value === null || value === "") return undefined;
  return value;
}

const text = (s: string | null | undefined) => (s ?? "").trim();

function visibleActions(links: ComparableAction[] | null | undefined) {
  return [...(links ?? [])]
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.is_active !== false)
    .sort((a, b) => (a.l.sort_order ?? a.i) - (b.l.sort_order ?? b.i) || a.i - b.i)
    .map(({ l }) => [l.type, text(l.label), text(l.value)]);
}

function comparable(content: ComparableContent) {
  const mode = content.mode === "redirect" ? "redirect" : "page";
  if (mode === "redirect") return { mode, redirect: text(content.redirect_url) };
  return {
    mode,
    title: text(content.title),
    config: canonical(content.config ?? {}),
    theme: canonical(content.theme ?? {}),
    actions: visibleActions(content.links),
  };
}

/**
 * True when publishing would change what customers see. A profile that has
 * never been published (no snapshot) always differs.
 */
export function differsFromLive(
  live: ComparableContent | null | undefined,
  draft: ComparableContent,
): boolean {
  if (!live) return true;
  return JSON.stringify(comparable(live)) !== JSON.stringify(comparable(draft));
}
