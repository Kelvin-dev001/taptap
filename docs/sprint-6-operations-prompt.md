# Sprint 6 — Order-to-Cash & Operations Console (brief + Claude Code prompt)

> **Rewritten 2026-08-30 to match D-018.** The earlier version of this brief proposed a
> "product purchase includes the first **month**, then a recurring subscription of undecided
> cadence" model. That was superseded before it was built: Sprint 6a settled pricing as
> **per identity**, with hardware including the first **twelve months** and a **KES 1,000
> per active identity per year** renewal after that. Everything below now assumes D-018.
> Do not reintroduce per-account plans, `maxProfiles`, or a monthly cadence.

**Why this is the priority:** Sprint 6a priced hardware but built no checkout for it, so
buying a card is still a manual conversation and fulfilment is untracked. For a
hardware-as-CAC business the biggest scaling risk is manual production becoming chaotic —
not the technology. This sprint makes the **Order** the spine: the customer creates it,
payment confirms it, staff fulfil it, and it starts the identity's twelve-month term.

## The business flow (target)

1. A visitor signs up **free** and builds a profile — no payment to build or publish.
2. To make it tappable they buy a **product**: Smart Card (KES 1,500) or Smart Stand
   (KES 2,000). This creates an **Order** and takes payment via **M-Pesa STK**.
3. On **payment confirmation**: the order is marked paid; an **identity is provisioned** —
   an `nfc_tags` row assigned to the account with `term_start = now` and
   `term_end = now + 12 months`; the order enters the fulfilment pipeline (assign token →
   produce → QC → dispatch → deliver).
4. From **year two**, the identity renews at KES 1,000/year through the existing
   consolidated renewal flow on the Billing page.

## Where entitlement lives (settled — do not re-model)

**`nfc_tags.term_end` is the single source of truth for entitlement.** The product/order
carries the rule (`bundled_months = 12`) and its payment *triggers* provisioning. Implement
that inside the order-payment confirmation handler, which writes the identity's term.
Do not store entitlement twice, and do not resurrect `subscriptions` for this.

**Most of the money path already exists.** `payments` already has `kind = 'hardware'` and
`quantity`; `payment_tags` already links a payment to the identities it covers; and the
callback's `activateIdentities()` already sets `term_start` and computes `term_end` via
`renewedTermEnd(null, now)`, which is exactly "twelve months from purchase" for a new
device. The gap is the **order** in front of it and the **token assignment** behind it —
not the payment mechanics.

## Design guidance (baked into the prompt)

- **Separate state machines, not one flat status.** Order/fulfilment, payment, and identity
  term move independently — join them in the views. Note that Sprint 6a already models the
  identity's billing state as *derived* from `term_end` (`identityState()` in
  `lib/identity.ts`) rather than stored; follow that pattern rather than adding a status
  column that can disagree with the date.
- **Audit every transition** (from → to, who, when) so you can spot what is *stuck*.
- **Proper staff roles + RLS**, not the shared `ADMIN_TOKEN`, for the internal console.
- Reuse the existing design system; real data only; enforce valid transitions.

## Ready-to-paste Claude Code prompt

```
You are the engineering partner for Hornbill TapTap (read CLAUDE.md, PROJECT.md, and
docs/decision-log.md first — D-018 in particular). We are starting Sprint 6 — Order-to-Cash
& Operations. Operate under the repo's sprint governance: AUDIT -> PLAN -> then STOP for my
approval before implementing anything.

WHY: the Order is the spine of the business. A customer creates it, payment confirms it,
staff fulfil it, and it starts the identity's twelve-month term. Today this is manual and
will become chaotic at scale. Build the full order-to-cash flow plus an internal, staff-only
operations console.

FIRST, AUDIT the current codebase and report back (do NOT assume names — read the code):
the DB schema + all migrations 0001-0015 (accounts, profiles, smart_pages, nfc_tags,
payments, payment_tags, events, leads); the per-identity billing code shipped in Sprint 6a
(lib/pricing.ts, lib/identity.ts, lib/billing-context.ts, the billing page + actions, and
app/api/mpesa/callback/route.ts including activateIdentities); how staff/admin access works
today (ADMIN_TOKEN, lib/admin-auth, app/admin); the design-system UI components; and current
routes. Then reconcile the plan below with what already exists — a lot of the money path is
already built and must be REUSED, not duplicated.

PRICING IS SETTLED (D-018). Do not re-open it, do not reintroduce per-account plans or
maxProfiles, and do not add a monthly cadence:
  - Smart Card  = KES 1,500 one-off, INCLUDES the first 12 months
  - Smart Stand = KES 2,000 one-off, INCLUDES the first 12 months
  - Renewal     = KES 1,000 per active identity per year, from year 2
  - Prices live in lib/pricing.ts. Keep that the single source of truth; if you add a
    products table, its rows must reference those constants rather than restating them.

TARGET BUSINESS FLOW:
1. Free signup + profile building (no payment to build or publish).
2. Customer buys a PRODUCT -> creates an ORDER -> pays via M-Pesa STK.
3. On payment confirmation: mark the order paid; PROVISION AN IDENTITY (assign an nfc_tags
   row to the account with term_start = now and term_end = now + 12 months); move the order
   into fulfilment; the device becomes "activated".
4. From year 2: the existing consolidated renewal flow on the Billing page keeps it active.

ENTITLEMENT RULE (important): nfc_tags.term_end is the SINGLE SOURCE OF TRUTH. The
product/order carries bundled_months = 12 and its payment TRIGGERS provisioning. Implement
provisioning in the order-payment confirmation handler. Do not store entitlement twice and
do not reuse the legacy subscriptions table for it.

REUSE, DO NOT REBUILD: payments.kind already supports 'hardware'; payments.quantity exists;
payment_tags already records which identities a payment covers (this is what makes callback
replay safe); and activateIdentities() already writes term_start/term_end correctly for a
new device. Extend that path for orders rather than writing a second one.

MODEL AS SEPARATE STATE MACHINES (not one flat status); record every transition with a
timestamp + which staff member made it (append-only audit log), so we can answer "who is
stuck in DESIGN for 5 days" and "whose identity expires this month":
  - Order/fulfilment: NEW -> CONTENT_RECEIVED -> DESIGN -> AWAITING_APPROVAL -> APPROVED
    -> IN_PRODUCTION -> QC -> READY_FOR_DISPATCH -> DISPATCHED -> DELIVERED, plus
    REVISION_REQUESTED (loop) and CANCELLED. Enforce allowed transitions.
  - Payment: reuse existing payments (pending/paid/failed).
  - Onboarding: profile_pending / content_submitted / activated.
  - Identity term: DERIVED from nfc_tags.term_end via identityState() in lib/identity.ts —
    active / expiring / grace / expired. Do NOT add a status column that duplicates it.

ENTITIES:
  - products: code, name, kind (card | stand), price_kes, bundled_months (= 12).
  - orders: human number (TT001...), account_id (nullable for pre-account leads), product,
    quantity, amount, customer name/contact, notes, timestamps; linked to assigned nfc
    tag(s), payment(s), and the identities they provisioned.
  - order_events: append-only audit (order_id, from_status, to_status, changed_by, note, at).

CUSTOMER-FACING:
  - A product/checkout page (the public /pricing page already states the prices — link from
    it rather than restating them): pick product -> pay via M-Pesa STK -> order created; on
    confirmation the identity is provisioned with its 12-month term and the order enters
    fulfilment.
  - Order status visible to the customer (paid, in production, dispatched, delivered,
    activated) in their dashboard.

STAFF ACCESS: do NOT gate a multi-user internal tool on the shared ADMIN_TOKEN. Add a
proper staff role (is_staff/role on profiles, or a staff table) with Supabase RLS so only
staff can read/write ops tables; audit staff access to customer data.

STAFF CONSOLE:
  - Orders table (Order#, Customer, Product, Fulfilment, Payment, Identity/term, Assigned
    token, Updated) with filters (status/product/paid), search, sort.
  - Production KANBAN by fulfilment stage; moving a card advances status and writes an
    order_event (timestamp + staff); enforce valid transitions only.
  - Order detail: full activity timeline, linked payment(s), assigned NFC token(s) + claim
    status, identity term end, contact, notes, actions (advance stage, assign/replace token,
    mark dispatched, request revision, cancel).
  - Ops metrics: counts per stage, aging/SLA flags (stuck > N days), unpaid orders, orders
    awaiting content, dispatch backlog, IDENTITIES expiring in 30 days (not accounts).
  - Identity lifecycle view (expiring-soon, in grace, expired). CSV export of orders.
  - RECONCILIATION VIEW: paid accounts holding zero claimed identities. D-018 left these
    unresolved on purpose — the console is the right place to work them off.

NON-FUNCTIONAL: reuse the existing design system; server-side staff auth + RLS; audit every
status change; REAL data only (no fabricated metrics); unit tests for the transition state
machine (valid transitions only), the 12-month provisioning calc, and aging/date logic; keep
all existing customer features working; do not weaken RLS.

DELIVERABLES: a Sprint 6 plan doc; a migration (products, orders, order_events, staff role
+ RLS); the checkout + order-payment -> identity-provisioning wiring; the staff console +
Kanban + order detail + metrics; and tests. Follow AUDIT -> PLAN -> STOP: present the plan
and wait for my approval before building. Record key decisions (Order as spine; separate
state machines; staff roles) in docs/decision-log.md.
```

> Prerequisite: migration `0015` must be applied before this sprint's migration runs — the
> order flow writes `nfc_tags.term_start`/`term_end`, which `0015` adds. See
> `docs/launch-checklist.md` §3.
