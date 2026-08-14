# Sprint UI-0 — UX/UI Audit & Design-System Architecture

**Date:** 2026-08-15 · **Status:** Complete (audit only — no application code changed)
**Deliverable of:** the UI/UX transformation phase opened after Sprints 0–5 shipped.

Hornbill TapTap is code-complete across Sprints 0–5 (tap → smart page → analytics → lead →
paid plan) but has **no design system at all**. `tailwind.config.ts` has `theme.extend = {}`,
`app/globals.css` is 15 lines declaring two CSS variables that only `body` consumes, and no
font-family is ever set — the product currently renders in each device's system UI face.
Every screen is styled with ad-hoc utility strings duplicated across files, wrapped in a
672px single column, with a "← Dashboard" text link as the only navigation.

This document is the UI-0 deliverable: audit, design-system architecture, and sequencing.

**Repo state verified 2026-08-15:** branch `main`, clean. `tsc --noEmit` clean.
`vitest run` 39/39 pass across 7 files. Next 16.2.11, React 19.2.8, Tailwind 3.4.19.

---

## 0. Reference image

`docs/reference/hornbill-taptap-mockup.jpg` (3750×2157), supplied as the visual direction.
It is a starting point to improve on, not a pixel spec (CLAUDE.md §7).

| Region | Direction it sets |
|---|---|
| Shell | ~200px light sidebar, workspace identity block ("Hornbill TapTap / BUSINESS SUITE"), 11 nav items, active item = soft-orange tint + orange label, plan card pinned bottom |
| Header | Page title + context subtitle, centered ⌘K search, live status pill, bell, dark "Publish changes" button, avatar |
| Metrics | 5-up row; **first card is charcoal** with orange sparkline + glow, remaining 4 white with one distinct sparkline hue each (blue/green/purple) |
| Editor | Logo tile w/ CHANGE overlay, slug chip + copy, `+ Add action` / Theme / Cover / SEO toolbar, action rows = drag handle + icon tile + label/URL + badge + **toggle** + edit + delete |
| Drag | Lifted row w/ orange border + shadow, dashed insertion zone reading "Drop to place above Instagram" |
| Preview | Phone/Tablet segmented control, "● Syncing" pill, realistic device frame, **exactly one orange CTA** — all other actions neutral |
| Charts | Bar chart, orange (taps) vs grey (QR), 7d/14d/30d tabs, legend, hover tooltip, "+21.6% vs prior" |
| AI | Charcoal card, HIGH IMPACT badge, insight + estimated lift + Apply/Dismiss |
| Mobile | Charcoal hero metric, 2-up stats, live activity feed, bottom tab bar with elevated orange NFC FAB |

**The single most important restraint to carry forward:** in the preview panel only *one*
button is orange. Orange marks the primary action and live/positive state — nothing else.

### Where the mockup must NOT be followed literally

These depict data the platform cannot produce. Building them as drawn would violate
CLAUDE.md §15 and non-negotiables #7/#8.

| Mockup element | Problem | Resolution |
|---|---|---|
| "GOOGLE REVIEWS **47** +12 new ★4.9 average" | TapTap only knows a review *link was clicked*. Review counts/ratings require the Google Business Profile API. | Relabel to **"Review link clicks"**. Real review counts = future integration, not UI-3. |
| "8,420 of 10,000 monthly taps used" | No quota model exists (`lib/plans.ts` limits are profiles/branding/leads/analytics). Also CLAUDE.md §21 forbids usage in billing UI. | Drop the quota card. Replace with plan name + renewal date + upgrade CTA. |
| "M-Pesa payment · KSh 1,450" in activity | TapTap processes *subscription* payments only. A "Pay with M-Pesa" block is a link/till — no settlement signal. | Log as **"M-Pesa link opened"**. Never "payment received". |
| Verified ✓ badge | No verification system exists. | Do not render until one exists. |
| "Team" nav item | Not built; CLAUDE.md §13 says don't add nav for future features. | Omit from nav. |
| AI recommendations card | Requires trustworthy data + a model — Sprint UI-10. | Design the slot in UI-3; render only real insights when UI-10 lands. |
| `taptap.hornbill.co.ke` | Real domain is `taptap.hornbilltech.co.ke` (D-007). | Use the real domain. |

---

## 1. Current UI audit

**Scope:** 13 routes, 3 shared components, ~2,400 LOC across `app/`, `lib/`, `components/`.

### Styling reality
- `tailwind.config.ts` — `theme.extend = {}`. **Zero tokens.**
- `app/globals.css` — 15 lines; `--background`/`--foreground` used only by `body`.
- **No font declared anywhere** → system stack by default.
- **No `public/` directory** → no favicon, no icons, no manifest, no OG image.
- No `components/ui/` layer. Three shared components total.
- No `error.tsx`, `loading.tsx`, or `not-found.tsx` anywhere → no skeletons, no error
  boundaries, no branded 404.

### Duplicated utility strings (the core justification for UI-1)

| Pattern | Occurrences |
|---|---|
| `rounded-lg border border-neutral-300 px-3 py-2` (input) | ~8 sites |
| `rounded-lg bg-neutral-900 px-5 py-2.5 font-medium text-white hover:bg-neutral-700` (primary button) | ~6 sites |
| `rounded-xl border border-neutral-200 p-4/p-5` (card) | ~6 sites |
| `text-sm text-neutral-500 hover:text-neutral-900` (back link) | 5 sites |
| `inputCls` const declared twice | `editor.tsx:33`, `lead-form.tsx:6` |

### Charts
`components/mini-charts.tsx` — dependency-free CSS bars, `bg-neutral-800` only, no axes,
no legend, no tooltip beyond `title=`. Serviceable; needs an SVG upgrade for the reference's
sparklines + hover.

---

## 2. UX problems (ranked by product impact)

1. **No app shell.** Every screen is a dead end. Cards and Billing are reachable *only* from
   two small links in the dashboard header. Nothing is discoverable.
2. **Dashboard barely answers "what happened"** — five raw counters, no trend, no comparison,
   no recommended action. Violates CLAUDE.md §14.
3. **The editor has no preview.** Save → open a new tab → refresh. This is the flagship gap
   and the whole reason UI-4 exists.
4. **No save-state feedback.** One text string that replaces itself; no dirty-state guard —
   navigating away silently discards everything.
5. **No per-action enable/disable** (schema gap, §9 B1), reorder is ↑/↓ only, no icons.
6. **No publish concept.** Every save is instantly live to the public. Dangerous for a real business.
7. **Link lifecycle incomplete.** `is_active` is rendered but never writable; no delete.
8. **Onboarding is a stub.** Account named from the email local-part; no business identity captured.
9. **Analytics hard-locked to 30 days**, no geo, per-page only — no account-level view.
10. **Leads are a raw table** — no detail, no status, no "WhatsApp this lead" action.
11. **Billing** — no receipts, no history, no cancel, no expiry state; prices are DRAFT.
12. **QR** is a bare download link — no preview, no size/format, no print sheet.
13. **Devices** show a token tail and a `<select>` — no naming, no per-device analytics.
14. **Public profile is plain** — no cover, all buttons identical weight, one accent for everything.
15. **`/admin` has no chrome**, gated only by a token typed into a form.

---

## 3. Information architecture

Routes nest under `/dashboard` — no `/[slug]` collision risk, and `middleware.ts` matcher
`/dashboard/:path*` already covers them unchanged (D-013).

| Nav | Route | Status |
|---|---|---|
| Dashboard | `/dashboard` | exists |
| Tap Profiles | `/dashboard/profiles` (+ `/[id]/edit`) | move from `/dashboard/[id]/edit` |
| NFC Devices | `/dashboard/devices` | rename from `/dashboard/tags` |
| Analytics | `/dashboard/analytics` (+ per-profile drill-down) | new account-level view |
| Customers | `/dashboard/customers` | promote from `/dashboard/[id]/leads` |
| Billing | `/dashboard/billing` | exists |
| Settings | `/dashboard/settings` | new (business identity) |

**Deliberately omitted:** Team (not built), QR Codes (belongs on profile + device detail, not
a top-level destination), Smart Business Cards.

**Smart Business Cards tension:** CLAUDE.md §13 lists it as nav, §17 says don't build a
disconnected second product. Recommendation — it is a *template facet* of Tap Profiles
(filter chip on the profiles list), promoted to its own nav item only if UI-5 proves it needs
a distinct workflow.

**⚠ Time-sensitive, independent of the nesting decision:** `/[slug]` is a **root catch-all**,
and `RESERVED_SLUGS` (`lib/reserved-slugs.ts`) is missing `analytics`, `customers`, `devices`,
`leads`, `qr`, `cards`, `team`, `insights`, `nfc`, `notifications`. Reserving these is free
today and breaking once a customer owns one. Add in UI-1.

---

## 4. Design system architecture

### 4.1 Color — and a WCAG finding that changes the reference

Sampled brand orange: **`#F97316`**. Every pairing was computed from WCAG relative luminance:

| Pair | Ratio | Verdict |
|---|---|---|
| `#F97316` text on white | 3.0:1 | ✗ fails normal text |
| **White on `#F97316`** | **2.80:1** | **✗ fails even large text (3:1)** |
| White on `#EA6A0C` | 3.20:1 | ✗ normal text |
| White on **`#C2560A`** | **4.53:1** | ✓ AA |
| Charcoal `#1A1A1A` on `#F97316` | 6.21:1 | ✓ AA |

**The mockup's white-on-vivid-orange buttons fail WCAG AA.** Resolution (D-012):

- `--primary` **`#F97316`** = fills that carry **no text**: sparklines, bars, toggle-on,
  status dots, icon tiles, progress, the mobile FAB, focus rings.
- `--primary-strong` **`#C2560A`** = **button fills with white labels** (4.53:1) and any
  orange **text** on white.
- Public-page hero CTA may instead use vivid `#F97316` with charcoal text (6.21:1) — keeps
  the mockup's exact energy while passing AA.

Also failing in current code: `text-green-600` `#16A34A` = **3.30:1 ✗** (used for "current
plan" and success messages) → success token becomes `#15803D` (5.01:1 ✓).
`text-neutral-400` = **2.52:1 ✗** (inactive status). `text-red-600` = 4.83:1 ✓ and
`text-neutral-500` = 4.74:1 ✓ both stay.

Semantic roles: `background`, `surface`, `surface-elevated`, `surface-inverse` (charcoal
`#141414` for hero metric + AI cards), `foreground`, `muted`, `border`, `border-strong`,
`primary`/`-strong`/`-hover`/`-active`/`-soft` (`#FFF1E6`, nav active)/`-subtle`, plus
`success` `#15803D`, `warning` `#B45309`, `danger` `#DC2626`, `info` `#1D4ED8`.

> The charcoal cards are **surfaces, not a dark theme.** The system stays light-only per §30.17.

### 4.2 Typography — Inter via `next/font` (self-hosted, zero CLS) — D-014

`display` / `page-title` / `section-title` / `card-title` / `body` / `body-sm` / `label`
(uppercase, .06em) / `caption` / `metric` (700, **tabular-nums**) / `numeric`.

### 4.3 Foundations
- **Spacing** 4px base: 1,2,3,4,5,6,8,10,12,16,20,24
- **Radius** `sm 6` `md 8` `lg 12` `xl 16` `2xl 20` `full` — pills only for badges/toggles (§8)
- **Elevation** 4 layered shadows, max `0 8px 24px -6px rgb(0 0 0 / 0.10)`; charcoal cards
  get an inner orange glow instead of a bigger shadow
- **Focus** `2px --primary` ring + `2px` offset, `:focus-visible` only, on every interactive element
- **Breakpoints** Tailwind defaults; `lg` (1024) is where the sidebar becomes permanent
- **States** default / hover / focus / active / disabled / loading / success / error on every component

---

## 5. Component inventory

`components/ui/` — vendored Radix + CVA (D-011). We own every file; Radix supplies focus
traps, roving tabindex, and ARIA wiring.

| Component | Source | Sprint |
|---|---|---|
| Button, IconButton | extract from 6 duplicated sites | UI-1 |
| Input, Textarea, Select | extract from 8 sites + 2 `inputCls` consts | UI-1 |
| Switch, Checkbox | Radix (`role="switch"`) | UI-1 |
| Card, MetricCard, Badge, Alert | extract from ~6 card sites | UI-1 |
| Dialog, Drawer, Toast | Radix Dialog + Toast | UI-1 |
| Skeleton, EmptyState, Spinner | new | UI-1 |
| Tabs, Dropdown, Tooltip, Popover | Radix | UI-2 |
| Sidebar, Topbar, MobileNav, PageHeader, Search | new | UI-2 |
| ChartContainer, Sparkline, BarChart | upgrade `mini-charts.tsx` → SVG | UI-3 |
| ActionRow, SortableAction, BlockPicker | new | UI-4 |
| MobilePreview | new (flagship) | UI-4 |
| Table, Pagination | extract from leads table | UI-8 |
| DeviceCard, QRPreview | new | UI-6 |

---

## 6. Motion system

Tokens: `fast 120ms` (hover/color), `base 180ms` (most), `slow 240ms` (dialogs/drawers);
easings `standard cubic-bezier(.2,0,0,1)`, `decelerate (0,0,0,1)`, `spring` for drag only.

| Interaction | Spec |
|---|---|
| Button | hover: bg + shadow 120ms; press: `scale(.98)`; release eased |
| Switch | thumb 180ms standard; track color cross-fades |
| Save | `Saving…` → `Saved ✓` with 1.2s hold, then fade — announced via `aria-live="polite"` |
| Drag | lift `scale(1.02)` + shadow-lg + orange border; dashed insertion zone; 180ms settle |
| Dashboard | staggered card entrance 40ms apart, **once per mount, no loops** |
| Charts | bars grow from baseline 240ms decelerate, stagger 20ms |
| Toast | slide-in-from-right + fade 180ms |
| Dialog | overlay fade + panel `scale(.96→1)` 240ms, focus trapped, ESC closes |
| Preview | content cross-fades 120ms as the user types — never a spinner |

**Reduced motion:** a global `@media (prefers-reduced-motion: reduce)` block collapses all
durations to `1ms` and removes transforms, while keeping opacity changes so state remains
legible. Motion is *neutralized*, not deleted.

---

## 7. Accessibility audit (WCAG 2.2 AA)

| # | Violation | Location | Criterion |
|---|---|---|---|
| A1 | `<label>` elements not associated with inputs (no `htmlFor`, not wrapping) | `create-profile-form.tsx:36,46,66,77` | 1.3.1, 3.3.2 |
| A2 | Every editor input is placeholder-only, **no labels at all** | `editor.tsx:172–363` | 3.3.2 |
| A3 | Placeholder-as-label throughout | `lead-form.tsx:70–120` | 3.3.2 |
| A4 | Inputs unlabeled; buttons sit **outside** a `<form>` → no Enter-to-submit; errors unannounced | `login/page.tsx:47–77` | 3.3.2, 2.1.1 |
| A5 | `<button>` + `window.location.href` for what are links — announced as "button", no middle-click/new-tab | `public-profile.tsx:96–107` | 4.1.2 |
| A6 | No `aria-live` on any async status (save, form errors, billing result) | editor, all forms | 4.1.3 |
| A7 | Status communicated by color alone (green/red text) | dashboard, billing, tags | 1.4.1 |
| A8 | `text-green-600` 3.30:1; `text-neutral-400` 2.52:1; `opacity-50/60` footers | multiple | 1.4.3 |
| A9 | No designed focus styling anywhere (browser default only) | global | 2.4.7, 2.4.13 |
| A10 | No skip-link; no `<nav>`/`<header>` landmarks | dashboard | 2.4.1 |
| A11 | Editor ↑/↓/✕ buttons ≈20–22px — below the 24px minimum | `editor.tsx:326–347` | **2.5.8 (new in 2.2)** |
| A12 | Delete/disable actions have **no confirmation** | tags, editor | 3.3.4 |
| A13 | `prefers-reduced-motion` unhandled | global | 2.3.3 |
| A14 | Errors not linked to fields via `aria-describedby` | all forms | 3.3.1 |

Sticky headers land in UI-2 — **2.4.11 Focus Not Obscured** must be verified there.

---

## 8. Responsive audit

| # | Issue | Location |
|---|---|---|
| R1 | `grid-cols-5` fixed — five metric tiles ≈55px wide at 320px | `dashboard/page.tsx:79` |
| R2 | `grid-cols-3` for six metrics — cramped on small phones | `analytics/page.tsx:63` |
| R3 | Leads table scrolls horizontally with no mobile card fallback | `leads/page.tsx:66` |
| R4 | Every page `max-w-2xl` (672px) — desktop wastes ~60% of viewport | all dashboard routes |
| R5 | `sm:grid-cols-2` is the **only** breakpoint used in the entire app | `editor.tsx:215` |
| R6 | No `viewport`/`themeColor` export | `app/layout.tsx` |
| R7 | No manifest, no icons, no `public/` — PWA-ready is currently false | repo root |

`components/public-profile.tsx` (`max-w-md`) is correctly mobile-first and needs no
structural change.

---

## 9. Backend & database implications

Per CLAUDE.md §19 — each is justified by a specific UX requirement, not aesthetics.

| # | UX need | Current state | Change | Migration | RLS | Back-compat |
|---|---|---|---|---|---|---|
| B1 | Per-action toggle | `links` has no active column | `add column is_active boolean not null default true`; filter in `get_public_page` | `0006` | none (`links_all_own` covers) | default `true` = today's behavior |
| B2 | Publish vs draft | `smart_pages` has no draft state; saves are instantly public | `status` + `published_at`, draft config alongside live config | `0007` (UI-4) | none | existing rows backfill `published` |
| B3 | NFC vs direct attribution | `/t/<token>` → `?src=nfc` is logged as `tap` — **identical to someone typing the URL** | `add column source text` to `events` | `0006` | RPC signature change (additive param) | null source = legacy |
| B4 | Per-device analytics ("Reception stand underperforming") | `events` has no `tag_id` — **this insight is impossible today** | `add column tag_id uuid references nfc_tags` | `0006` | owner-scoped via existing page join | nullable |
| B5 | Cover image, SEO fields | — | none — `config` jsonb absorbs it; extend `PageConfig` type only | **none** | none | additive |
| B6 | New block types (menu, booking, mpesa, youtube, image, text, hero) | `links.type` is free text with **no CHECK constraint** | none — extend `BlockType` union + `buildHref` | **none** | none | additive |
| B7 | Analytics range selector | RPCs already accept `p_days` | none | **none** | none | — |
| B8 | Account-level analytics screen | `get_account_overview` returns totals only | new RPC returning daily series + per-page breakdown | `0006` | `security definer` + `auth.uid()` scoping, same pattern | additive |
| B9 | Live activity feed | derivable from `events` + `leads` + `payments` | new read RPC | `0006` | as above | additive |
| B10 | Business onboarding fields | `accounts` has only `name`, `plan` | add `profile jsonb` (category, logo, location, phone, whatsapp, website, review link) | `0007` | `accounts_update_own` exists ✓ | additive |
| B11 | `events.region` | column exists, **never written** | populate from `x-vercel-ip-country-region`, or drop | `0006` | none | — |
| B12 | Delete / deactivate link | RLS already allows update+delete | **no migration** — server actions + confirm dialog only | **none** | none | — |
| B13 | Subscription expiry | `planFor()` ignores `current_period_end` — a lapsed plan keeps full features forever, and the billing UI would show the wrong plan | expiry check at read time | none | none | correctness fix |
| B14 | Notifications (bell) | nothing exists | **defer** — do not render a non-functional bell | — | — | — |

Migrations `0006` (analytics + action state) and `0007` (publish + onboarding) are the only
two proposed. Everything else is additive TypeScript.

---

## 10. Dependencies

| Package | Why | Size | Sprint |
|---|---|---|---|
| `eslint` + `eslint-config-next` + flat config | **`npm run lint` is currently broken** — `next lint` was removed in Next 16 (verified: no lint command in `next/dist/bin`) *and* eslint was never installed (0 refs in `package-lock.json`). The `eslint-disable` comments in `editor.tsx`/`public-profile.tsx` are dead. CLAUDE.md §26 requires lint every sprint. Script becomes `"lint": "eslint ."` | dev | **UI-1** |
| `@radix-ui/react-{dialog,dropdown-menu,tooltip,popover,switch,tabs,select}` | Focus traps, roving tabindex, ARIA — what makes AA realistic | ~35–45KB, tree-shaken | UI-1 |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Typed variant API; kills the duplication in §1 | ~2KB | UI-1 |
| `lucide-react` | Mockup is icon-dense; none installed today | ~1KB/icon | UI-1 |
| `jsdom`, `@testing-library/react`, `@vitejs/plugin-react` | `vitest.config.ts` is `environment: "node"` with `include: ["**/*.test.ts"]` — **components cannot be tested at all today** | dev | UI-1 |
| `@dnd-kit/core` + `/sortable` | Keyboard-accessible drag. Native HTML5 DnD is **not** keyboard accessible → would fail 2.1.1 | ~10KB | UI-4 |

**Not adding:** no chart library (hand-rolled SVG in `ChartContainer` — revisit at UI-7);
no `framer-motion` (CSS transitions cover the spec; revisit only if UI-4 needs layout
animation). `next/font` is built in. No unrelated dependency upgrades during this phase.

---

## 11. Technical debt

1. `npm run lint` broken (above) — dead `eslint-disable` comments.
2. Zero design tokens; ~20 duplicated utility strings.
3. Component tests impossible (vitest node env, `.test.ts` only).
4. No error/loading/not-found boundaries on any route.
5. `export const dynamic = "force-dynamic"` on every dashboard route — no caching anywhere.
6. `components/public-profile.tsx` is entirely a client component — the whole tap page ships
   as JS on the most latency-sensitive surface, on Kenyan mobile networks. Should be
   server-rendered with a small client island.
7. `<img>` instead of `next/image` in 2 places; no image optimization.
8. No `public/`, no favicon, no OG image.
9. `RESERVED_SLUGS` missing the future nav vocabulary (§3).
10. Subscription expiry unenforced (B13).
11. `events.region` collected-never-written (B11).

---

## 12. Implementation sequence

Each sprint runs AUDIT → PLAN → IMPLEMENT → TEST → FIX → REVIEW → DOCUMENT → COMMIT → **STOP**.

| Sprint | Contents | Backend |
|---|---|---|
| **UI-1** Foundation | Tokens, Inter, `components/ui/` (Button…Toast), reduced-motion, focus system, fix lint, component test harness, reserve slugs | none |
| **UI-2** Shell | Sidebar, topbar, mobile nav, page headers, route moves w/ redirects, Settings shell | B10 (`0007`) |
| **UI-3** Dashboard | Hero charcoal metric, trend deltas, SVG sparklines, activity feed, empty states, insight slot (empty until UI-10) | B8, B9 |
| **UI-4** Builder ★ | Simple Mode, block picker, dnd-kit reorder, **live preview**, save/publish states, per-action toggle | B1, B2, B5, B6 |
| **UI-5** Cards | Business-card template on the same engine | none |
| **UI-6** NFC + QR | Device inventory, naming, QR preview/formats/print, physical card test | B3, B4 |
| **UI-7** Analytics | Range selector, click-vs-conversion labelling, per-device breakdown, export | B11 |
| **UI-8** Customers | Lead detail, status, WhatsApp/call actions, mobile cards | small |
| **UI-9** Billing | Plan, renewal, history, receipts, cancel — **no usage/team/branch cards** (§21) | B13 |
| **UI-10** AI | Only on trustworthy data; real insights only | TBD |
| **UI-11** PWA | Manifest, icons, offline shell, install | none |
| **UI-12** Polish | Perf, a11y sweep, browser QA, error/loading states | none |

**Critical path:** UI-1 → UI-2 → UI-3/UI-4. UI-10 is hard-blocked on UI-7.

---

## Sprint UI-0 closeout

**Completed:** full repository audit (UI, UX, IA, a11y, responsive, backend, debt), design
system architecture, component inventory, motion spec, dependency justification, and the
12-sprint sequence. Four decisions recorded as D-011 → D-014.

**Files changed:** `docs/sprint-ui-0-audit.md` (new), `docs/reference/hornbill-taptap-mockup.jpg`
(new), `docs/decision-log.md`, `PROJECT.md`, `CLAUDE.md` (now tracked).

**Backend/database changes:** none. Two migrations *proposed* (`0006`, `0007`), neither written.

**Tests run:** `npm run typecheck` clean; `npm test` 39/39 pass. `npm run lint` **broken —
pre-existing**, not a regression (see §10); fixed in UI-1.

**Defects found, not fixed (deferred by sprint):** 14 accessibility violations (§7),
7 responsive issues (§8), 11 technical-debt items (§11), subscription expiry unenforced (B13).

**Risks:**
- The mockup promises six things the data cannot support (§0). Shipping them as drawn would
  breach the no-fabrication rule — each has a documented honest replacement.
- Route moves in UI-2 need redirects from the old `/dashboard/[id]/*` URLs.
- `RESERVED_SLUGS` gaps are cheap to fix now and breaking after launch.
- Physical NFC verification remains outstanding from Sprint 5 and blocks UI-6 acceptance.

**Next sprint proposal:** UI-1 — Design System Foundation. Tokens, Inter, `components/ui/`
primitives, focus + reduced-motion systems, working ESLint, component test harness, slug
reservation. No page redesign. Acceptance: all existing functionality intact, 39/39 tests
still green, lint passing for the first time.
