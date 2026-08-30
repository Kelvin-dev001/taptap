# Sprint 6a — Per-identity pricing & billing

**Status:** built, awaiting migration + acceptance · **Date:** 2026-08-30 · **Decision:** D-018

Reworks billing from per-account plan tiers to a per-identity model. Sprint 6
(order-to-cash and the operations console) builds on the data model this
establishes — which is why this ran first.

---

## The model

| Thing | Price |
|---|---|
| Smart Card | **KES 1,500** one-off, includes the first 12 months |
| Smart Stand | **KES 2,000** one-off, includes the first 12 months |
| Renewal, per active identity | **KES 1,000 / year**, from year 2 |

An **identity** is one physical device and whichever profile it currently points
at. The **tag is the identity** — repointing a card never creates or destroys a
billing unit (D-009).

Segments are packaging, not count-gates: **Professional** (individuals, one card,
basic report), **Business** (SMEs, cards + stands, full report, own branding),
**Commercial** (multi-location, team access, priority support, sales-led).

---

## Audit findings that changed the work

1. **Entitlement was a single row.** `subscriptions.account_id` is `UNIQUE`, so the
   whole app resolved entitlement against one row per account. That is the change.
2. **The plan was stored three times.** `accounts.plan` (**read by nothing** — dropped),
   `subscriptions.plan` (legacy), `subscriptions.plan_code` (the live one).
3. **Two features were sold and never enforced.** `customBranding` and
   `advancedAnalytics` appeared on the billing page from Sprint 4; the "Powered by
   Hornbill TapTap" footer rendered unconditionally and the full report was open to
   everyone. Both gates are now real.
4. **`resolve_slug` is dead code** — the slug route reads the snapshot via
   `get_public_page`. Gated anyway: it is granted to `anon`, so leaving it open
   would have been a way to read a lapsed page's destination.
5. **Nothing on the public path consulted billing.** Enforcement was a three-function
   change, not a scattered one.
6. **The callback's extension arithmetic was already right** — `max(now, existing_end)`
   means an early renewal adds a year. It moved to `renewedTermEnd` unchanged and is
   now shared by both paths.

---

## Files changed

**New**
- `lib/pricing.ts` — the single source of truth for money, segments and terms
- `lib/identity.ts` — per-identity state machine (the UI-9 `subscriptionState` shape, one level down)
- `lib/billing-context.ts` — one guarded read of "what does this account own"
- `supabase/migrations/0015_per_identity_billing.sql`
- `app/pricing/page.tsx` — public pricing
- `components/billing/billing-overview.tsx`, `identity-list.tsx`, `entitlement-notice.tsx`
- `components/profile/inactive-notice.tsx`
- `components/shell/billing-card.tsx`
- `lib/pricing.test.ts`, `lib/identity.test.ts`, `components/billing/identity-list.test.tsx`

**Deleted** — `lib/plans.ts`, `lib/plans.test.ts`, `components/billing/plan-status.tsx`,
`app/dashboard/billing/billing-plans.tsx`, `components/shell/plan-card.tsx`

**Modified** — billing page + actions, M-Pesa callback, dashboard layout, app shell,
profile create/edit actions + edit page, both analytics pages, the CSV export route,
payment history, receipt, `profile-view.tsx`, `lib/profile.ts`, `lib/payments.ts`

---

## Database changes (migration `0015`)

- `nfc_tags` += `kind` (`card|stand`), `term_start`, `term_end`, index on `term_end`
- `accounts` += `segment`; **dropped** `accounts.plan` (verified dead)
- `payments` += `kind` (`hardware|renewal`), `quantity`; `plan_code` relaxed to nullable
- **new** `payment_tags(payment_id, tag_id)` + owner-read RLS, service-role writes
- **new functions** `billing_grace_days()`, `identity_is_live()`, `page_is_live()`,
  `account_has_custom_branding()`
- **redefined** `get_public_page` (adds `billing_state` + `custom_branding` to its jsonb —
  no extra round trip on the tap path), `resolve_tag` (adds an `expired` status),
  `resolve_slug` (gated)
- **backfill** — generic over every non-free account; each claimed device inherits the
  account's existing `current_period_end`, so nobody's clock restarts

**Security:** no RLS policy weakened. `payment_tags` follows the `payments` pattern —
owner-read through the existing set-membership predicate, writes service-role only.
The renewal action intersects posted tag ids with what the account actually owns, so a
tampered form cannot pay for someone else's device.

---

## Tests

350 → **388 passing, 37 files** (20 of the old count were the deleted `plans.test.ts`). New: 25 pricing (amounts, calendar-month terms with
leap and month-end clamping, early-vs-lapsed renewal, segment gating, zero-identity
fallback, catalogue monotonicity), 22 identity (state boundaries, grace window,
billable-vs-active, derived renewal date, consolidated pricing), 7 identity-list
(the Radix checkbox → `formData.getAll("tag")` contract, repricing, disabled submit),
4 `describePayment`.

Typecheck, lint and production build all clean.

**Not covered by tests:** the SQL backfill arithmetic and callback replay against a real
database. Both need the migration applied — see acceptance below.

---

## Acceptance — what a person still has to do

1. **Run the Phase 0 reconciliation query** (read-only) and decide what happens to any
   paid account holding zero claimed devices.
2. **Apply `0015`** in the Supabase SQL editor.
3. **Prove the M-Pesa callback end to end** — still the only thing blocking revenue, and
   now it must also be checked that `nfc_tags.term_end` moves a year out and that a
   replayed callback does not move it twice.
4. **Tap a lapsed card** and confirm the inactive screen renders rather than a 404.

---

## Deferred to Sprint 6

Orders, fulfilment pipeline, staff roles and the operations console. Hardware *purchase*
is priced here but has no checkout yet — buying a device is still a manual conversation,
and the order flow is what makes it self-serve. `subscriptions` is now unread by the app;
dropping it (and the signup trigger's insert) is cleanup for that sprint, once the
migration has been proven in production.

**Also deferred, deliberately:** renewal reminder emails. The rules exist
(`RENEWAL_WARNING_DAYS`, `GRACE_DAYS`) and Resend is wired from UI-13, but sending them on
a schedule needs a cron route and a decision about cadence. In-app warnings ship now.
