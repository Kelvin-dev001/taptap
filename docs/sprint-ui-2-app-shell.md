# Sprint UI-2 — Application Shell

**Date:** 2026-08-15 · **Status:** Complete · **Follows:** `docs/sprint-ui-1-design-system.md`

Before this sprint every dashboard screen was a 672px column with a "← Dashboard" text link
as its only navigation, and two of the seven areas (Cards, Billing) were reachable solely
from small links in the dashboard header. UI-2 gives the product a real frame and the
information architecture agreed in UI-0.

---

## What shipped

### 1. The shell (`components/shell/`)

| File | Role |
|---|---|
| `app-shell.tsx` | Frame: sidebar from `lg` up, sticky header, skip link, landmarks |
| `nav-links.tsx` | Shared nav rendering for sidebar and drawer — one source, no drift |
| `mobile-nav.tsx` | Drawer navigation below `lg` |
| `page-header.tsx` | Title, description, breadcrumbs, action slot — used by every page |
| `account-menu.tsx` | Dropdown with business name, email, settings, billing, sign out |
| `command-palette.tsx` | ⌘K search across real profiles and nav destinations |
| `plan-card.tsx` | Plan name and route to billing |
| `logo.tsx` | Inline SVG hornbill mark and wordmark |

`app/dashboard/layout.tsx` performs one auth check and one workspace fetch for all dashboard
routes, so pages stopped repeating `getUser()` + redirect.

**Accessibility:** a skip link is the first focusable element (closes finding A10); sidebar
and drawer are distinct labelled `<nav>` landmarks; the active section carries
`aria-current="page"` so it is not signalled by the orange tint alone (1.4.1). The sticky
header is 3.5rem and `<main>` carries `scroll-mt-16`, so a focused element scrolled into view
is never hidden beneath it — **WCAG 2.2 §2.4.11 Focus Not Obscured**, which UI-0 flagged as
the risk of introducing a sticky header.

### 2. Information architecture

Routes moved with `git mv`, so history is preserved:

| Was | Now |
|---|---|
| `/dashboard` (list + create + metrics) | `/dashboard` (metrics only) + `/dashboard/profiles` (list + create) |
| `/dashboard/[id]/edit` | `/dashboard/profiles/[id]/edit` |
| `/dashboard/[id]/analytics` | `/dashboard/profiles/[id]/analytics` |
| `/dashboard/[id]/leads` | `/dashboard/profiles/[id]/leads` |
| `/dashboard/tags` | `/dashboard/devices` |
| — | `/dashboard/analytics`, `/dashboard/customers`, `/dashboard/settings` (new) |

`next.config.mjs` redirects every legacy URL. Verified live: `/dashboard/tags` →
`/dashboard/devices`, `/dashboard/<id>/edit` → `/dashboard/profiles/<id>/edit`, and the same
for analytics and leads.

Nav omits **Team** and **Notifications** (not built — CLAUDE.md §13), **QR Codes** (belongs on
a profile and on a device, not a destination) and **Smart Business Cards** (a template facet
of Tap Profiles, §17). `lib/nav.test.ts` asserts those absences so they cannot creep back in.

### 3. New pages, real data only

- **Settings** — business name, category, location, phone, WhatsApp, website and Google review
  link, saved to `accounts.name` + `accounts.profile`. This is the first consumer of
  migration `0007`.
- **Customers** — unified lead inbox across every profile. Needed **no** new RPC:
  `leads_select_own` already scopes a plain select to the caller's pages. Phone and email
  render as real `tel:`, `mailto:` and `wa.me` links.
- **Analytics** — an index that routes into the existing, real per-profile analytics. It
  deliberately shows **no** account-wide chart: `get_account_overview` returns bare totals
  with no daily series and no prior period, so a roll-up or trend here would be invented.
  An inline note says account-wide reporting is coming rather than faking it.

The dashboard home keeps its real 30-day totals and shows **no deltas**, for the same reason —
there is nothing to compare against yet. Metric labels now say what was actually measured
("Button clicks", not "Conversions").

### 4. Pages adopted the design system

`login`, `profiles`, `devices`, `billing`, `settings`, per-profile `analytics` and `leads` now
use `Card`, `Button`, `Badge`, `Field`, `Input`, `Select`, `Alert`, `EmptyState` and
`PageHeader`.

Accessibility findings closed on the pages touched:
- **A1 / A4** — `create-profile-form` and `login` migrated to `Field`; every control has an
  associated label. Login is now a real `<form>` with a submit handler, so Enter works and
  errors are announced (previously the buttons sat outside any form).
- **A14** — errors reach controls via `aria-describedby`.
- **R1** — dashboard metrics were `grid-cols-5` at every width (≈55px tiles on a phone); now
  2 → 3 → 5 across breakpoints.
- **R2** — per-profile analytics was a fixed `grid-cols-3` for six metrics; now 2 → 3 → 6.
- **R3** — the leads table now has a stacked card layout below `sm`, so nothing depends on
  horizontal scrolling.
- **R4** — pages are no longer capped at 672px; the shell uses the full width up to `max-w-5xl`.

---

## Backend and database

**Migration `0007_business_profile.sql`** (audit item B10):

1. `accounts.profile jsonb not null default '{}'` — jsonb rather than columns because the
   field set is still moving, matching the existing `smart_pages.config` pattern. Business
   name stays in `accounts.name`, which already exists.
2. **Column-level grants on `accounts`.** Nothing wrote to this table before, so the
   permissive `accounts_update_own` policy was harmless. A Settings form changes that, and an
   RLS policy governs *which rows* a user may write, never *which columns* — so policy alone
   would let a signed-in user update any column on their own account row, including
   `accounts.plan`. That column is vestigial today (gating reads `subscriptions.plan_code`,
   and the M-Pesa callback writes via the service role), so this was not a live escalation
   path, but introducing a write path while leaving it open is how one gets created. Now:
   `revoke update on accounts from authenticated` then
   `grant update (name, profile) to authenticated`, plus the missing `with check` half of the
   policy. The signup trigger is `SECURITY DEFINER` and the callback uses the service role,
   so neither is affected.

**Also changed:** `lib/supabase/middleware.ts` now redirects unauthenticated requests to
`/login` instead of only refreshing the session — see the defect below.

> **Kelvin must run `0007_business_profile.sql` in the Supabase SQL editor.** Settings will
> fail to save until then. This is now the second unrun migration alongside `0005`.

---

## Defects found and fixed

1. **Pages render even while the layout is redirecting.** Layouts and pages render
   *concurrently* in the App Router, so moving the auth check into
   `app/dashboard/layout.tsx` did not stop page code from executing when signed out. The
   Settings page dereferenced `user!.id` and threw `TypeError: Cannot read properties of null`
   on every signed-out request. Fixed in two layers: a real guard in the page, and a redirect
   in the middleware so unauthenticated requests are turned away at the edge before any page
   query runs. Confirmed: 12 routes, zero runtime errors.
2. **Two `setState`-in-effect errors** caught by lint — the command palette reset its cursor
   in an effect (one render with a stale highlight before correcting), and the mobile drawer
   watched `pathname` to close itself (rendering the new page with the drawer still open).
   Both replaced with event-driven updates.
3. A stale `.next` type cache kept referencing the old route paths after `git mv`; cleared.

---

## Tests

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **95 passed** (77 + 18 new), 16 files |
| `npm run build` | compiled successfully, 23 routes |
| Route smoke | 12 routes checked live; all legacy redirects resolve; **0 runtime errors** |
| Visual | `/login` confirmed rendering Inter, tokens, `Card`/`Field`/`Button`, and the AA-safe `#C2560A` primary |

New tests: `lib/nav.test.ts` (exactly one section active per route; every nav segment is
reserved; Team/Notifications absent) and `components/shell/{nav-links,command-palette}.test.tsx`
(`aria-current`, combobox semantics, arrow-key navigation, and that an empty workspace
suggests nothing invented).

---

## Not done, and why

- **The authenticated shell was not visually verified.** Signing in needs credentials I do not
  have and must not handle. It is covered by the production build, the route smoke test and
  component tests — but Kelvin should eyeball the sidebar, drawer and ⌘K palette after signing
  in, and especially check the drawer on a real phone.
- **Profile lifecycle (delete / deactivate a link) is still missing** and is now the oldest
  open UX gap. Audit item B12 needs no migration — server actions plus the existing
  `ConfirmDialog`. It is unassigned in the UI-0 sequence; recommend folding it into UI-4.
- **Finding A5** (public profile's `<button>`-as-link) remains open for UI-4 as planned.
- **Notifications** were listed for UI-2 in CLAUDE.md §29 but deliberately skipped: no
  notification system exists, and a bell that does nothing is worse than no bell (§30.19).
- **Logo** is an inline SVG approximation. If Hornbill has an official mark, drop it in and
  replace `components/shell/logo.tsx`.

## New technical debt

- `middleware.ts` triggers a Next 16 deprecation warning: the `middleware` file convention is
  now `proxy`. A rename touching the auth session path deserves its own change, not a
  drive-by at the end of a UI sprint.
- Carried forward: no error/loading boundaries, `force-dynamic` everywhere,
  `public-profile.tsx` fully client-rendered, no `public/` or favicon, subscription expiry
  unenforced (B13), `events.region` collected-never-written (B11).

## Next sprint proposal — UI-3: Dashboard

Turn the home screen into actionable intelligence: hero charcoal metric, period-over-period
deltas, SVG sparklines, an activity feed and useful empty states. Requires audit items **B8**
(account-level RPC returning a daily series *and a prior period* — the precondition for any
honest delta) and **B9** (activity feed RPC), which means migration `0008`. The AI insight
slot from the reference is designed but stays empty until UI-10.
