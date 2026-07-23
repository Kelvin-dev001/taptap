# Sprint 4 — Billing — Plan

**Status:** ✅ Built — pending live verification (2026-07-22) · **Est:** ~2 weeks (roadmap weeks 8–9)
**Goal:** turn TapTap into a real SaaS — paid plans, payment via **M-Pesa STK push**
(Daraja) and **Paystack** (cards), a subscription lifecycle, and **plan gating** that
enforces tier limits. This is the recurring-revenue engine.

> Planning mode: for approval. No build until you sign off — and this sprint needs
> external accounts set up (below) before it can go live.

## Prerequisites (Kelvin sets up — needed before/while building)

- **Safaricom Daraja** app: consumer key + secret, a Lipa-na-M-PESA shortcode/paybill,
  the passkey, and a public HTTPS callback URL (our Vercel/subdomain URL).
- **Paystack** account: public + secret keys and a webhook URL.
- A **server-only Supabase service-role key** (added to env, never exposed to the client)
  so webhooks can activate subscriptions.

## Objectives

1. Define plans (tiers, prices, limits) as the single source of truth.
2. Take payment via M-Pesa STK push and Paystack; confirm via callbacks/webhooks.
3. Manage the subscription lifecycle (activate, renew, expire).
4. Enforce plan limits across the app (gating).

## Plans (draft — confirm before building)

| Plan | Price (KES) _(draft)_ | Limits |
|------|----------------------|--------|
| Free | 0 | 1 profile, TapTap branding, basic analytics |
| Starter | 500/mo · 5,000/yr | 1 profile, custom branding, remove TapTap branding, vCard |
| Pro | 1,500/mo · 15,000/yr | multiple profiles, lead capture, advanced analytics |
| Business | 4,000/mo | teams/branches (post-MVP), priority |

Cadence for v1 (confirm): **annual-first** (per decision D-006 — M-Pesa recurring is
customer-initiated/awkward); monthly optional.

## Deliverables

- **Plans** as code constants + a `plans` reference row set; limits in one place.
- **Payments**: initiate flow (authenticated) → `payments` row (pending) → provider
  checkout → callback/webhook confirms → subscription activated/extended.
- **M-Pesa STK push** (Daraja): initiate (server), callback endpoint to confirm.
- **Paystack**: initialize transaction + signed webhook to confirm.
- **Subscription UI**: a pricing/upgrade page; current plan + renewal date + status in
  the dashboard.
- **Plan gating**: enforce limits (e.g. Free = 1 profile; branding removal, lead
  capture, advanced analytics behind paid tiers) on the server (create-profile action,
  feature access) and reflected in the UI.

## Acceptance criteria

- A user can pick a plan, pay with M-Pesa (STK prompt on phone) or card, and on success
  their subscription becomes active with a correct `current_period_end`.
- Gating holds server-side: a Free user cannot exceed limits even via direct calls.
- Callbacks are idempotent and signature/authenticity-verified; a replayed webhook does
  not double-extend a subscription.
- Amounts are set server-side from the plan (never trusted from the client).

## Architecture

- **Initiation** (authenticated server action/route): create a `payments` row with a
  unique reference and the server-derived amount; call the provider.
- **Confirmation** (external webhook/callback, no user session): verify authenticity,
  look up the `payments` row by reference, mark paid, and activate the subscription via
  a **service-role** Supabase client or a SECURITY DEFINER `activate_subscription` RPC
  (webhooks can't use the caller's RLS context).
- **Gating**: a small `lib/plans.ts` (limits per plan) + server checks; `subscriptions`
  is the source of truth for the account's current plan.

## Database considerations (migration 0004)

- `plans` (code, name, price_kes, interval, limits jsonb) — reference data.
- `payments` (id, account_id, plan_code, provider, reference unique, amount, currency,
  status pending|paid|failed, raw jsonb, created_at). Index on reference.
- Extend `subscriptions` (already has plan/status/provider/current_period_end): add
  `plan_code` and `external_ref` if needed.
- `activate_subscription(p_account_id, p_plan_code, p_period_end, p_provider, p_ref)`
  SECURITY DEFINER, idempotent by `p_ref`.

## UI considerations

- Clear pricing page; obvious "current plan" and renewal date; friendly M-Pesa STK
  waiting state ("check your phone for the PIN prompt"); graceful failure/retry.

## Security

- Secret keys server-only (env); never in the client bundle.
- Verify Paystack signature (HMAC SHA512) and validate Daraja callbacks; idempotency by
  reference; server-set amounts.
- Store no card data (Paystack-hosted). Service-role key used only in webhook/server
  routes.

## Performance / scalability

- Payment volume is low; standard. Keep webhooks fast and idempotent; reconcile async if
  needed.

## Testing strategy

- Unit: plan-limit logic; Paystack signature verification; amount derivation.
- Integration: initiate → simulated callback → subscription active; idempotent replay;
  gating blocks over-limit actions server-side.
- Use provider sandboxes (Daraja sandbox, Paystack test keys) before going live.

## Documentation

- README: env vars (Daraja, Paystack, service-role key), callback/webhook URLs, sandbox
  vs production; update `PROJECT.md` and the decision log (confirm D-006 specifics).

## Potential risks

- Daraja sandbox↔production differences and callback URL/HTTPS requirements (needs the
  live domain).
- M-Pesa recurring is not true auto-billing — annual-first + renewal reminders mitigate.
- Reconciliation/failed-callback edge cases — mitigated by the `payments` table + idempotency.
- Tax/VAT and receipts — flagged, out of MVP scope; note for later.

## Technical debt review (end of sprint)

Confirm secrets are server-only, webhooks idempotent and verified, gating enforced
server-side (not just UI), and no plan/limit logic duplicated — before Sprint 5.

## Build status (2026-07-22)

**Decisions confirmed:** M-Pesa STK push first (Paystack = fast-follow); annual-first;
draft tier prices in `lib/plans.ts` (Kelvin to send exact KES amounts).

**Shipped in-repo:**

- Migration `0004_billing.sql` — `payments` table (RLS owner-select; writes server-only)
  + `subscriptions.plan_code`/`external_ref`.
- `lib/plans.ts` — tiers, limits, `planFor`/`withinProfileLimit` (+ tests).
- `lib/supabase/admin.ts` — service-role client (server-only; verified not referenced
  anywhere else).
- `lib/mpesa.ts` — Daraja OAuth token, STK push, `normalizePhone` (+ tests).
- Initiate: `startCheckoutAction` records a pending `payment` (service role) and fires
  the STK push. Confirm: `/api/mpesa/callback` verifies by checkout id, is idempotent,
  marks paid, and extends the subscription by a year.
- Billing UI at `/dashboard/billing` (current plan + renewal + subscribe-by-phone);
  "Billing" link in the dashboard.
- Gating: profile-count limit enforced in create-profile; lead-capture gated by plan in
  the editor save — both server-side.

**Needs Kelvin (before it works live):** add `SUPABASE_SERVICE_ROLE_KEY` + `MPESA_*`
env vars; create a Daraja app (sandbox first); run migration `0004`; set the callback
URL; confirm plan prices. Then `npm run build`, push, and test the STK flow in sandbox.

**Deferred:** Paystack (cards) fast-follow; STK query-status polling for slow callbacks;
renewal reminders; receipts/VAT. Payment flow is **untested here** — needs Daraja
sandbox; expect 1–2 iterations.
