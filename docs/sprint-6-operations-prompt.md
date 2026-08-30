# Sprint 6 — Order-to-Cash & Operations Console (brief + Claude Code prompt)

**Why this is the priority:** for a hardware-as-CAC business, the biggest scaling risk
is manual production/fulfillment becoming chaotic — not the technology. This sprint makes
the **Order** the spine of the whole business: the customer creates it, payment confirms
it, staff fulfil it, and it seeds the subscription.

## The business flow (target)

1. A visitor signs up **free** and builds/customizes a profile — no payment to build.
2. To go live with a physical device, they buy a **product** (e.g. Review Stand,
   KES 1,500). This creates an **Order** and takes payment via **M-Pesa STK**.
3. On **payment confirmation**: the order is marked paid; the account's **subscription is
   activated with the first month included** (`current_period_end = now + 1 month`); the
   order enters the **fulfilment pipeline** (assign NFC token → produce → QC → dispatch →
   deliver); the card becomes "activated".
4. From **month 2** onward, the recurring subscription keeps the software active;
   expiry/renewal is handled by billing.

## Where the "first month" lives (answered)

The **subscription** is the single source of truth for entitlement ("active until X").
The **product/order** carries the rule (`bundled_subscription_months = 1`) and its payment
*triggers* activation. Implement the first-month activation inside the **order-payment
confirmation handler**, which writes to the subscription. Do not model entitlement twice.

## Model change to confirm (revisits D-006)

This shifts from "annual-first plans only" to **product purchase (incl. month 1) +
recurring subscription**. Kelvin to confirm: the **recurring price after month 1**, and
whether recurring is **monthly or annual**. Encode prices in one place (`lib/plans.ts` /
a `products` table), draft values clearly marked.

## Design guidance (baked into the prompt)

- **Separate state machines, not one flat status.** Order/fulfilment, payment,
  onboarding, and subscription lifecycles move independently — join them in the views.
- **Audit every transition** (from → to, who, when) so you can spot what's *stuck*.
- **Proper staff roles + RLS**, not the shared `ADMIN_TOKEN`, for the internal console.
- Reuse the existing design system; real data only; enforce valid transitions.

## Ready-to-paste Claude Code prompt

```
You are the engineering partner for Hornbill TapTap (read CLAUDE.md, PROJECT.md, and
docs/decision-log.md first). We are starting Sprint 6 — Order-to-Cash & Operations.
Operate under the repo's sprint governance: AUDIT → PLAN → then STOP for my approval
before implementing anything.

WHY: the Order is the spine of the business. A customer creates it, payment confirms it,
staff fulfil it, and it seeds the subscription. Today this is manual and will become
chaotic at scale. Build the full order-to-cash flow plus an internal, staff-only
operations console.

FIRST, AUDIT the current codebase and report back (do NOT assume names — read the code):
the DB schema + all migrations (accounts, profiles, subscriptions, payments,
nfc_tags/devices, events, leads); the billing/subscription code (lib/plans.ts,
lib/payments.ts, effectivePlan/subscriptionState, the M-Pesa flow + callback); how
staff/admin access works today (ADMIN_TOKEN, lib/admin-auth); the design-system UI
components; and current routes. Then reconcile the plan below with what already exists.

TARGET BUSINESS FLOW:
1. Free signup + profile building (no payment to build/customize).
2. Customer buys a PRODUCT (e.g. Review Stand KES 1,500) -> creates an ORDER -> pays via
   M-Pesa STK.
3. On payment confirmation: mark order paid; ACTIVATE the subscription with the first
   month bundled (current_period_end = now + 1 month); move the order into fulfilment;
   the device becomes "activated".
4. From month 2: recurring subscription keeps the software active; billing owns
   renewal/expiry.

FIRST-MONTH RULE (important): the SUBSCRIPTION is the single source of truth for
entitlement. The PRODUCT/ORDER carries bundled_subscription_months = 1 and its payment
TRIGGERS activation. Implement first-month activation in the order-payment confirmation
handler (which writes to the subscription). Do not store entitlement in two places.

PRICING/MODEL: this revises D-006 (annual-first) to product-purchase-incl-month-1 +
recurring subscription. Ask me to confirm the recurring price and cadence (monthly vs
annual) during PLAN; keep all prices in one source of truth with clearly-marked drafts.

MODEL AS SEPARATE STATE MACHINES (not one flat status); record every transition with a
timestamp + which staff member made it (append-only audit log), so we can answer "who is
stuck in DESIGN for 5 days" and "whose subscription expires this month":
  - Order/fulfilment: NEW -> CONTENT_RECEIVED -> DESIGN -> AWAITING_APPROVAL -> APPROVED
    -> IN_PRODUCTION -> QC -> READY_FOR_DISPATCH -> DISPATCHED -> DELIVERED, plus
    REVISION_REQUESTED (loop) and CANCELLED. Enforce allowed transitions.
  - Payment: reuse existing payments (pending/paid/failed).
  - Onboarding: profile_pending / content_submitted / activated.
  - Subscription: active / expiring_soon / expired (derived from current_period_end).

ENTITIES:
  - products: code, name, type (card | stand | ...), price_kes, bundled_subscription_months.
  - orders: human number (TT001...), account_id (nullable for pre-account leads), product,
    quantity, amount, customer name/contact, notes, timestamps; linked to assigned nfc
    token(s), payment(s), and the subscription.
  - order_events: append-only audit (order_id, from_status, to_status, changed_by, note, at).

CUSTOMER-FACING:
  - A simple product/checkout page: pick product -> pay via M-Pesa STK -> order created;
    on confirmation, subscription activates (month 1) and the order enters fulfilment.
  - Order status visible to the customer (paid, in production, dispatched, delivered,
    activated) in their dashboard.

STAFF ACCESS: do NOT gate a multi-user internal tool on the shared ADMIN_TOKEN. Add a
proper staff role (is_staff/role on profiles, or a staff table) with Supabase RLS so only
staff can read/write ops tables; audit staff access to customer data.

STAFF CONSOLE:
  - Orders table (Order#, Customer, Product, Fulfilment, Payment, Activation/Subscription,
    Assigned token, Updated) with filters (status/product/paid), search, sort.
  - Production KANBAN by fulfilment stage; moving a card advances status and writes an
    order_event (timestamp + staff); enforce valid transitions only.
  - Order detail: full activity timeline, linked payment(s), assigned NFC token(s) + claim
    status, subscription expiry, contact, notes, actions (advance stage, assign/replace
    token, mark dispatched, request revision, cancel).
  - Ops metrics: counts per stage, aging/SLA flags (stuck > N days), unpaid orders, orders
    awaiting content, dispatch backlog, subscriptions expiring in 30 days.
  - Subscription lifecycle view (expiring-soon, expired). CSV export of orders.

NON-FUNCTIONAL: reuse the existing design system; server-side staff auth + RLS; audit
every status change; REAL data only (no fabricated metrics); unit tests for the transition
state machine (valid transitions only), the first-month activation, and aging/date logic;
keep all existing customer features working; do not weaken RLS.

DELIVERABLES: a Sprint 6 plan doc; a migration (products, orders, order_events, staff role
+ RLS); the checkout + order-payment->activation wiring; the staff console + Kanban + order
detail + metrics; and tests. Follow AUDIT -> PLAN -> STOP: present the plan and wait for my
approval before building. Record key decisions (Order as spine; separate state machines;
first-month-bundled model revising D-006; staff roles) in docs/decision-log.md.
```
