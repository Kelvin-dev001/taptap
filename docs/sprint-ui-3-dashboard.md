# Sprint UI-3 — Dashboard

**Date:** 2026-08-15 · **Status:** Complete · **Follows:** `docs/sprint-ui-2-app-shell.md`

The dashboard showed five raw counters for a fixed 30-day window with no trend, no
comparison and no indication of what to do next — the "wall of numbers" CLAUDE.md §14 warns
against. This sprint turns it into something that answers *what happened, what matters, and
where to look*.

---

## The constraint that shaped the sprint

§14 asks for `1,284 taps ↑ 18.2%`. A percentage change requires a **prior period**, and
`get_account_overview` returned totals for one window only. There were two options: show
deltas computed from nothing, or build the comparison window. §30.7 forbids the first, so the
backend work was not optional — it is the precondition for the feature.

That constraint produced the rule at the centre of this sprint:

> **There is no percentage change from a zero baseline.** A metric going 0 → 40 has an
> undefined change, not "+100%". `percentChange()` returns `undefined` and the card renders
> **new** instead, with a screen-reader explanation that there was no prior activity to
> compare against.

`lib/metrics.test.ts` and `components/ui/metric-card-delta.test.tsx` lock this down end to
end — including that no path can ever render `Infinity` or `NaN`.

---

## What shipped

### 1. Migration `0008_dashboard_rpcs.sql` (audit items B8 + B9)

**`get_dashboard_overview(p_days)`** returns, all scoped by `auth.uid()` through
`SECURITY DEFINER`:

| Field | Purpose |
|---|---|
| `totals` | event counts for the window |
| `previous` | the same-length window immediately before — the honest-delta baseline |
| `leads` / `previous_leads` | same, for lead submissions |
| `daily` | zero-filled day axis with tap/scan/view/click, so a quiet day is a gap not a missing point |
| `top_pages` | which profiles drove the numbers |
| `top_blocks` | clicks per action — **clicks**, never completions |

**`get_recent_activity(p_limit)`** unions lead submissions, contact saves and button clicks.
Raw taps/scans/views are excluded on purpose: they are high-volume and would bury the things
a person actually did. Those live in the metrics.

`get_account_overview` is **left in place** — superseded, but dropping it would break callers
mid-deploy (§19.7). Nothing calls it now.

### 2. Charts, dependency-free (`components/charts/`)

- **`Sparkline`** — SVG polyline + gradient area. Handles a flat series without dividing by
  zero. Decorative and `aria-hidden`; the number and delta beside it carry the meaning.
- **`BarChart`** — each bar is a real `<button>` carrying an `aria-label` with its full
  numbers, so keyboard and screen-reader users get exactly what a mouse user gets from the
  hover tooltip.
- **`RankedBars`** — horizontal ranked list with printed values, so the bar reinforces rather
  than replaces the number.
- **`ChartContainer`** — title, note, legend, actions slot.

No chart library was added. A polyline and a rectangle are a few lines of maths; the smallest
credible dependency is ~100KB, which is real weight on a Kenyan mobile connection.
`components/mini-charts.tsx` is deleted and the per-profile analytics page now uses the same
components, so there is one chart implementation rather than two.

### 3. The dashboard

- **Charcoal hero metric** for Taps with an orange sparkline and the inner glow from the
  reference, then four secondary metrics each with their own sparkline and delta.
- **Range selector** (7 / 30 / 90 days) held in the URL, so a view is shareable and survives
  refresh, and the server re-queries — no client-side fetching or duplicated state.
  `parseRange` accepts only the three supported values and falls back to 30 for anything else,
  including junk and injection attempts.
- **Taps and scans by day** bar chart with a legend and per-bar tooltips.
- **Recent activity** feed, **Most-clicked actions**, and **Busiest profiles**.
- Metric cards fade up in a 40ms stagger, once on mount; reduced motion neutralises it.
- Empty state when the account has no profiles, pointing at the one useful next action.

### 4. Honest language throughout

`lib/metrics.ts` centralises the wording so it cannot drift per screen:

| Shown | Not shown | Why |
|---|---|---|
| "Button clicks" | "Conversions" | we see the click, nothing after it |
| "Review link opened" | "Review left" | the reference mockup's phrasing claims knowledge we do not have |
| "WhatsApp opened" | "Message sent" | the link fired; the conversation is invisible to us |
| "Contacts saved" | — | genuinely completed: the vCard download fires from our own code |
| "new" | "+100%" | no baseline exists to compute a change from |

A test asserts no metric label contains "conversion" and no click phrase contains
*left / received / paid / submitted / completed*.

### 5. Failure mode worth noting

If migration `0008` has not been run, the RPCs 404 and an empty result would be
indistinguishable from "no profiles yet" — telling an owner with live cards to create their
first link. The page now checks the RPC error explicitly and says which migration to run.

---

## Deliberately not built

- **The AI insight slot stays empty.** UI-0 sequenced it for UI-10 and it is hard-blocked on
  trustworthy data. A deterministic rule engine ("your top action is not in the top position")
  is computable from `sort_order` + click counts and would be honest — but it is not this
  sprint's scope, and calling rules "AI" is the sort of thing §30.8 exists to prevent.
- **Geography.** `events.country` is collected but `region` is never written (audit item B11).
  Rather than a map with one dimension missing, this waits for UI-7.
- **Export.** UI-7.

---

## Tests

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **115 passed** (95 + 20 new), 18 files |
| `npm run build` | compiled successfully, 23 routes |
| Route smoke | `?range=7`, `?range=90` and `?range=abc` all handled; **0 runtime errors** |

## Defects fixed

1. `MetricCard` gained a `style` prop in its type but not its destructuring — caught by
   typecheck before it could ship a silently ignored animation delay.
2. The UI-2 middleware redirect carried the dashboard's query string onto `/login`
   (`/login?range=7`). Now stripped.

## Technical debt

Unchanged from UI-2, plus: `lib/metrics.ts` duplicates the event-type vocabulary that also
exists in the `events_type_check` constraint and `lib/profile.ts`. If a seventh event type is
added, three places need updating. Worth consolidating when UI-7 touches the event schema for
`source`/`tag_id` (B3/B4).

> ⚠ **Migrations `0005`, `0007` and `0008` are all written but unrun.** The dashboard will
> show a warning banner until `0008` is applied.

## Next sprint proposal — UI-4: Tap Profile Builder

The flagship. Simple Mode with a block picker, keyboard-accessible drag-and-drop via
`@dnd-kit`, **live mobile preview**, explicit save/publish state using the `SaveState`
primitive built in UI-1, and per-action enable/disable. Backend: **B1** (`links.is_active`),
**B2** (publish vs draft), **B5**/**B6** (cover, SEO and new block types — no migration
needed). Also the right home for two carried-over items: **finding A5** (the public page's
`<button>`-as-link) and **B12** (profile delete/deactivate, still unassigned).
