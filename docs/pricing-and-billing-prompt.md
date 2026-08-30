> **SUPERSEDED — this work is done.** The model below was accepted as **D-018** and
> shipped in Sprint 6a on 2026-08-30 (`18216fb`). Kept for the reasoning that led to
> it. Do not re-run the prompt at the bottom; see `docs/sprint-6a-pricing-billing.md`
> for what was built and `docs/sprint-6-operations-prompt.md` for what comes next.

# Pricing & Billing — corrected model + Claude Code prompt

This supersedes the earlier draft plan prices. The real model is **per-identity**, not
per-account plan tiers.

## The model

An **identity** = one physical TapTap device (card or stand) + its digital profile. The
identity is the billing unit.

- **Hardware (one-time, includes the first 12 months):**
  - Smart Card — KES 1,500
  - Smart Stand — KES 2,000
- **Annual renewal — KES 1,000 per active identity / year** (from year 2). ✅ Confirmed
  by Kelvin (2026-07-24) — it is 1,000/year, not 500.
- **Segments (packaging, not count-gates):**
  - **Professional** — individuals; 1 identity; card only; basic analytics; standard support.
  - **Business** — SMEs; multiple identities; cards + stands; business analytics; optional
    team management; business support.
  - **Commercial** — organizations with multiple locations/teams; advanced analytics; team
    management; priority support; **sales-led** ("From KES 1,000/identity/year — Talk to
    Sales"), no fixed public checkout.

## Recommendations (baked into the prompt)

- **Consolidated annual renewal:** all of an account's identities share one renewal date;
  amount = active-identity count × renewal price; one M-Pesa payment renews all. Simpler
  than staggered per-card anniversaries.
- **Non-renewal → identity goes inactive** (card stops resolving, profile shows expired),
  reactivating on payment.
- **Tiers = segments**, so gating keys off analytics depth / team management / support,
  not a `maxProfiles` number.

## This replaces the current code model

Current billing is per-account plan tiers (Free/Starter/Pro/Business, `maxProfiles`,
KES 5k/15k/40k). That is wrong for this model and must be reworked to per-identity. The
prompt tells Claude Code to audit the current billing code and propose a safe migration.

## Claude Code prompt — pricing & billing rework

```
You are the engineering partner for Hornbill TapTap (read CLAUDE.md, PROJECT.md, and
docs/decision-log.md first). Task: rework pricing & billing to a PER-IDENTITY model.
Operate under sprint governance: AUDIT -> PLAN -> STOP for my approval before building.

FIRST, AUDIT the current billing implementation and report (read the code, don't assume):
lib/plans.ts, lib/payments.ts, the subscriptions + payments tables/migrations,
effectivePlan/subscriptionState/purchasedPlan, the billing page + components, and the
M-Pesa STK flow + callback. Then reconcile the new model below with what exists and
propose a safe migration (don't break existing subscriptions/payments).

THE MODEL (replaces the current per-account plan model):
- Billing unit = a TAPTAP IDENTITY (one physical card or stand + its digital profile).
- Hardware price is ONE-TIME and INCLUDES THE FIRST 12 MONTHS:
    Smart Card  = KES 1,500
    Smart Stand = KES 2,000
- Annual renewal = KES 1,000 per active identity per year, from year 2 (confirmed).
- Segments are PACKAGING, not count-gates:
    Professional (individuals): 1 identity; card only; BASIC analytics; standard support.
    Business (SMEs): multiple identities; cards + stands mix; BUSINESS analytics; optional
      team management; business support.
    Commercial (organizations): multiple identities/locations/teams; ADVANCED analytics;
      team management; priority support; SALES-LED - no fixed public checkout, show
      "From KES 1,000/identity/year - Talk to Sales".
- RENEWAL: implement CONSOLIDATED annual renewal by default - all of an account's active
  identities share one renewal date; the amount = (active identity count) x renewal price;
  one M-Pesa payment renews all. (Confirm this vs per-identity staggered dates.)
- Non-renewal: an unrenewed identity goes INACTIVE - its card stops resolving and its
  profile shows an "expired/renew" state. Reactivates on payment.
- The unit ties to the physical device (nfc_tag) and a profile; buying hardware creates an
  identity and starts its 12-month term (integrate with the orders/products flow if present).

DELIVERABLES:
- A single source of truth for prices (products + renewal) with clearly-marked values.
- Migrate the data model from per-account plan/maxProfiles to per-identity subscriptions
  (each identity has its own term; account has a consolidated renewal date + count).
- Billing page (dashboard): list the account's identities with per-identity status +
  renewal date, the total annual renewal (count x price), a "Renew all" M-Pesa action,
  and payment history. Show the account's segment + a "Talk to Sales" path for Commercial.
- Public pricing page: the 3 segments, hardware prices, renewal price, and Talk-to-Sales
  for Commercial.
- Gating keys off SEGMENT + features (analytics depth, team management), not maxProfiles.

NON-FUNCTIONAL: reuse the design system; server-side + RLS; real data only; unit tests for
the pricing math (count x renewal), first-year-term calc from purchase, consolidated
renewal date, and segment-based gating; keep existing customer data intact; do not weaken
RLS. Record the decision (per-identity model; consolidated renewal; revises D-006) in
docs/decision-log.md.

Follow AUDIT -> PLAN -> STOP: present the plan (including the data migration) and wait for
my approval before building.
```

> Note: this billing rework and the order-to-cash / ops sprint (see
> `sprint-6-operations-prompt.md`) share the same entities (products, identities, orders,
> subscriptions). If running both, do the pricing/billing rework first (or fold them into
> one Sprint 6) so the data model is consistent.
