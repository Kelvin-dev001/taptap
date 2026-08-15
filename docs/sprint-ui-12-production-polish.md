# Sprint UI-12 — Production polish

**Date:** 2026-08-15 · **Status:** Complete · **Final sprint of the UI/UX transformation**
**Follows:** `docs/sprint-ui-11-pwa-mobile.md`

This sprint added no features. Its job was to close what the previous eleven deferred, and to
check honestly whether the UI-0 findings actually closed rather than assuming they had.

---

## What the audit found that I had missed

Grepping the codebase against the UI-0 findings turned up something nine sprints of reporting
had not: **four surfaces were never migrated to the design system at all.**

| Surface | Why it mattered |
|---|---|
| `/t/[token]` claim form | **On the core NFC path** — the first authenticated screen after tapping a new card, still on pre-design-system styling with an unlabelled select |
| `/` landing page | The first thing anyone sees |
| `/privacy`, `/terms` | Public, and required for ODPC compliance |
| `/admin` | Internal, but still a real screen |

Every sprint had migrated the pages it touched, and nothing ever swept for pages no sprint
touched. All four are migrated now. The claim form is the one that mattered: it sits between
a customer tapping a brand-new card and that card working.

## Findings closed, with where

| # | Finding | Closed in |
|---|---|---|
| A1 | Unassociated labels on the create form | UI-2 (`Field`) |
| A2 | Editor inputs placeholder-only | UI-4 |
| A3 | **Public lead form placeholder-as-label** | **UI-12** — the last one, and the only form a *customer* fills in |
| A4 | Login unlabelled, buttons outside the form | UI-2 |
| A5 | Links rendered as `<button>` | UI-4 |
| A6 | No `aria-live` on async status | UI-1 (`SaveState`), UI-2 |
| A7 | Status by colour alone | UI-1 (`Badge` dot + text) |
| A8 | Contrast failures | UI-1 (tokens; `text-green-600` was 3.30:1) |
| A9 | No focus styling | UI-1 |
| A10 | No skip link or landmarks | UI-2 |
| A11 | Sub-24px targets | UI-4 (drag replaced the ↑/↓/✕ buttons) |
| A12 | No confirmation on destructive actions | UI-4 (`ConfirmDialog`) |
| A13 | `prefers-reduced-motion` unhandled | UI-1 |
| A14 | Errors not linked to fields | UI-1 (`Field` + `aria-describedby`) |
| R1–R7 | Responsive and PWA gaps | UI-2, UI-3, UI-7, UI-8, UI-11 |

## Also fixed here

**A duplicate query on the tap path.** UI-11 added `generateMetadata` to `/[slug]` without
noticing that it called `get_public_page` a second time per request — doubling database round
trips on the single most latency-critical route in the product, the one a customer waits on
with a phone against a card. Now deduped per request with React's `cache()`; the OG image
route shares it too, so three callers make one query.

**Error, loading and not-found boundaries**, absent on every route since UI-0:

- `app/error.tsx` — Next's default says *"Application error: a client-side exception has
  occurred"*, which tells a shop owner nothing. This admits fault, offers retry, and shows the
  digest, which is the only handle a customer can quote in a support message.
- `app/dashboard/error.tsx` — nested inside the shell, so when one screen fails the navigation
  survives and an owner can move somewhere that works.
- `app/[slug]/not-found.tsx` — **the one 404 with a real audience**: a customer standing in a
  shop who has just tapped a dead card. A stock error page tells them the business is broken.
- `loading.tsx` for the dashboard and profiles, shaped like the real page so the layout does
  not jump.

**`middleware.ts` → `proxy.ts`**, deprecated since Next 16 and deliberately deferred because
it sits on the auth path. Verified after the rename: `/dashboard`, `/dashboard/profiles` and
`/dashboard/customers` still redirect to `/login` when signed out.

---

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **283 passed**, 29 files |
| `npm run build` | compiled successfully, no deprecation warnings |
| Route smoke | auth enforced after the rename; unknown slug → branded 404; 0 runtime errors |
| Visual | the branded 404 was opened in a browser and read as a customer would see it |
| Schema | migrations `0005`–`0013` all confirmed applied against the live database |

---

## The transformation, end to end

Thirteen sprints from UI-0. What changed:

- **Before:** `theme.extend = {}`, no font declared, ~20 duplicated utility strings, every
  screen a 672px column with a "← Dashboard" link as its only navigation.
- **After:** a token system, 20+ vendored primitives, an app shell, a builder with live
  preview and publish, analytics that distinguish a click from a conversion, a lead workflow,
  billing that enforces expiry, deterministic insights, and an installable PWA.
- **9 migrations**, each justified by a specific UX requirement and none written for
  aesthetics.
- **283 tests**, up from 39 — most of them encoding rules the product must not break rather
  than checking that functions return values.

Three findings had money or trust attached and would have shipped without the audit:
**B13** (a lapsed subscription kept every paid feature indefinitely), **the missing
`tag_id`** (per-card analytics was not merely unbuilt, it was unanswerable), and **`config.seo`
never being read** (every shared link previewed as our name on their business).

---

## What remains — and what only Kelvin can do

**Blocking launch, not code:**

1. **Confirm the plan prices.** `lib/plans.ts` has carried a DRAFT marker since Sprint 4 and
   exports `PRICES_ARE_DRAFT`. M-Pesa STK push charges real money against these numbers.
2. **Physical NFC verification** — an acceptance requirement from UI-0, still outstanding.
   Steps are in `docs/sprint-ui-6-nfc-qr.md`.
3. **Hands-on testing of the builder.** Drag, upload, publish, template switching and seeding
   are covered by tests and typechecks, but no human has clicked through them. Flagged since
   UI-4 and still true.
4. The pre-existing launch list: DNS for `taptap.hornbilltech.co.ke`, Vercel env vars, the
   M-Pesa callback on a public URL, ODPC registration, and the `[bracketed]` placeholders in
   `/privacy` and `/terms`.

**Known technical debt, deliberately left:**

- The hornbill mark is still the UI-2 placeholder — a real brand asset is a ten-minute swap of
  `components/shell/logo.tsx` and the three icon routes.
- `force-dynamic` on every dashboard route. Correct while everything is per-account and live,
  but some of it is cacheable and nobody has measured.
- No error reporting service; boundaries log to the console.
- `components/public-profile.tsx` is still fully client-rendered on the latency-critical tap
  path (UI-0 debt item, never scheduled).
- Insights recompute per dashboard load; thresholds are global rather than per-account.
- Lead status is per-submission, not per-person (D-015, reversible).

**Recommended next, once launched:** notifications — the only item from the original feature
list that is both absent and repeatedly missed. A lead arrives and nobody is told; an owner
must open the dashboard to find out. Everything needed to send is now in place: the lead
workflow, the business phone and WhatsApp in Settings, and a stale-lead insight already
identifying exactly who has not been replied to.
