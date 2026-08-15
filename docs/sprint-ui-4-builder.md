# Sprint UI-4 — Tap Profile Builder

**Date:** 2026-08-15 · **Status:** Complete · **Follows:** `docs/sprint-ui-3-dashboard.md`

The flagship sprint. The editor was a stack of unlabelled inputs with ↑/↓ reorder buttons and
no preview — the only way to see a change was Save, open a new tab, refresh. Every save went
straight to the public page.

---

## What shipped

### 1. Live preview that cannot drift

`components/profile/profile-view.tsx` is now the **single renderer** for a smart page. The
public page and the builder preview both use it:

- `mode="live"` — real anchors, analytics, working vCard download
- `mode="preview"` — inert. Nothing navigates, nothing is tracked, no lead is submitted

Preview fidelity is therefore structural rather than maintained by hand: there is no second
implementation to fall out of sync. `components/public-profile.tsx` shrank to a wrapper that
adds only what belongs on a real page.

The preview updates directly from editor state — no save, no reload, no iframe — inside a
phone/tablet frame with a badge showing whether it is ahead of what is saved.

### 2. Publish lifecycle (migration `0009`, audit item B2)

A **snapshot** model, not version history. `links`, `config` and `theme` stay the editable
draft; publishing copies the current state into `smart_pages.published_content`, which is what
the public path serves.

- An owner can edit a live page without the edits going out mid-sentence — UI-0's UX problem #6.
- **Unpublish** takes a page off the air without deleting it; the snapshot is kept so
  republishing restores exactly what was live.
- The tap path got cheaper: one row read instead of a join.
- `resolve_slug` and `resolve_tag` respect publish status too, or "unpublish" would only half
  work — a card would still redirect to a page the owner had taken down.

**The migration cannot take a live page down.** `get_public_page` serves
`published_content` when present and otherwise falls back to building the snapshot live, so
pages that predate the migration keep working; a backfill then fills them in.

### 3. Per-action state and drag-and-drop (audit item B1)

`links.is_active` gives each action a real toggle. Disabled actions stay in the editor and
never reach the public page — filtered inside `build_page_snapshot`, so the rule lives in one
place rather than in each caller.

Reordering uses **dnd-kit**, chosen because the HTML5 drag API cannot be operated from a
keyboard at all and would fail WCAG 2.1.1 outright. The drag handle is a real button: focus
it, press Space, move with the arrow keys, and dnd-kit announces each move.

### 4. Simple Mode

- **Block picker** grouped into *Popular in Kenya* (WhatsApp, Google review, M-Pesa,
  Directions), Contact, Social and Business — §22, and it keeps the list from being one long
  scroll.
- Action rows are collapsed by default and expand to reveal their fields, so ten actions is a
  readable list rather than thirty visible inputs (§12).
- Everything beyond the essentials — contact card, theme, lead capture, SEO — sits behind a
  single **Advanced** disclosure.
- Four new block types (**YouTube, Menu, Booking, M-Pesa**) needed no migration: `links.type`
  has no CHECK constraint, so a type is a TypeScript entry plus a href rule.
- Cover image, tagline and SEO fields ride in `config` jsonb — audit item B5, no migration.

### 5. Save and publish states

Explicit `Save draft` (disabled until something changes) with the `SaveState` primitive built
in UI-1 — *Saving… → Saved ✓* in an `aria-live` region — plus a `beforeunload` guard so
navigating away no longer silently discards work (UX problem #4). Publishing an unsaved draft
saves first, because otherwise the button would quietly publish the *previous* version.

### 6. Carried-over items closed

- **Finding A5** — navigational blocks render as real `<a>` elements instead of `<button>`
  driven by `window.location`. They announce as links and support middle-click and
  open-in-new-tab again. vCard and M-Pesa stay buttons because they act in-page.
- **Audit item B12** — profile **delete** and **deactivate**, missing since UI-0. Delete goes
  through `ConfirmDialog` spelling out the consequences (WCAG 3.3.4): the link stops working,
  analytics and leads go, and any NFC card bound to it becomes unassigned rather than pointing
  at nothing.

### 7. Accent contrast, generalised

Owners pick any button colour, so `onAccentColor()` computes whether the label should be dark
or light from WCAG relative luminance. This is D-012's lesson applied to user input rather
than just to the brand: a light accent with white text would fail exactly as
white-on-orange did. A test asserts every one of twelve sample accents reaches AA.

---

## Honesty notes

- **M-Pesa is not a payment.** The block shows a till or paybill for the customer to enter.
  `buildHref` returns null for it, the editor says so in a hint, and a test asserts the block
  never claims a payment was made.
- The mockup's activity phrasing stays rejected: a click on a review button is a review link
  opened, nothing more.

---

## Tests

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **152 passed** (124 + 28 new), 22 files |
| `npm run build` | compiled successfully, 23 routes |
| Route smoke | public routes 200, dashboard 307; **0 runtime errors** |

New coverage: live-vs-preview parity, anchors for navigational blocks, disabled actions hidden
from the public page, `sort_order` respected, preview firing no analytics, every block href
rule, accent contrast across twelve colours, and the schema guard below.

## Defects fixed

1. **lucide-react v1 removed all brand icons** (Instagram, Facebook, YouTube, LinkedIn,
   Twitter) over trademark concerns — typecheck caught the missing exports. Social actions now
   use generic stand-ins; real brand marks would have to come from each platform's own assets
   under their terms.
2. A test of mine scraped the footer's Privacy link into the action-label comparison and
   failed. The test was wrong, not the code.

## Deploy ordering — new safety net

Migrations are applied by hand, so a deploy can run ahead of the schema. UI-4 queries
`status`, `published_at` and `links.is_active`; before `0009` those errors return null rows,
which would render as **"no links yet"** on the profiles list and a **404** in the editor —
telling an owner their live page had vanished.

`lib/schema-guard.ts` now distinguishes "the column is not there yet" (Postgres `42703`,
`42883`, PostgREST `PGRST202`/`PGRST204`) from a genuinely missing row, and the affected
screens show which migration to run. The UI-3 dashboard check was refactored onto the same
helper, and now separates a pending migration from a real failure instead of treating every
error as the former.

> ⚠ **Migrations `0005`, `0007`, `0009` are pending** (`0008` is applied — the UI-3 error
> trace proved it). Run `0009` before using the builder.

## Technical debt

- **The builder has not been exercised by hand.** Drag-and-drop, upload, publish and the
  preview are covered by unit tests and typecheck, but no one has dragged a real row. This
  needs a pass on a real phone.
- Publishing is a snapshot, not history: there is no "revert to previous version". The column
  holds the last published state, so adding history later means a side table, not a rewrite.
- `savePageAction` replaces the whole `links` set per save. Fine at this size, and analytics
  survive because `events.link_id` is `ON DELETE SET NULL` — but it does churn ids, so a
  per-action click history will need diffing instead.
- Carried forward: no error/loading boundaries, `force-dynamic` everywhere, no `public/` or
  favicon, subscription expiry unenforced (B13), `events.region` unwritten (B11),
  `middleware`→`proxy` rename pending.

## Next sprint proposal — UI-5: Smart Business Cards

Per D-011's reading of §17, this is a **template facet** of Tap Profiles rather than a second
product: a personal-card preset of the same engine (name, title, company, vCard-first layout),
a template picker at creation time, and the profiles list gaining a type filter. No new
rendering path and no migration expected — the work is presets and defaults over the builder
that now exists.
