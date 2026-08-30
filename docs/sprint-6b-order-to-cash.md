# Sprint 6b — Order-to-cash

**Status:** built, awaiting migration `0017` + acceptance · **Date:** 2026-08-30 · **Decision:** D-019

The customer-facing half of Sprint 6: a customer can buy hardware, pay by M-Pesa, and watch
the order to delivery. The operations console — staff roles in use, Kanban, orders table,
metrics — is **Sprint 6c** and builds on the schema laid here.

---

## What a customer can now do

1. Sign in, open **Billing → Get a device**, pick Smart Card or Smart Stand and a quantity.
2. Pay by M-Pesa STK. The order is created first, so a failed push leaves an unpaid order
   ops can chase rather than an untracked charge.
3. On confirmation the callback provisions one identity per unit — a token from the
   pre-minted pool where possible — each with a twelve-month term.
4. Follow it at **/dashboard/orders**, from *Awaiting payment* through to *Delivered*.

## Audit findings that shaped the build

1. **Nothing of Sprint 6 existed** — no orders, products, order_events or staff code.
2. **`ADMIN_TOKEN` cannot support an ops console.** One shared secret, no identity, so "who
   moved this order" is unanswerable — which makes the audit log impossible. Its in-memory
   rate limiter is also per serverless instance (the file says so). Kept for minting only.
3. **The design system has no `Table` or `Pagination`**, both required by CLAUDE.md §9.
   Every list so far is a card/`<ul>`, fine for an owner's three leads and wrong for staff
   scanning 200 orders. **Deferred to 6c as design-system work**, since it is reusable well
   beyond ops.
4. **`leads.status` is the precedent and is deliberately weaker** — a check-constrained
   column with no transition rules and no history. What was worth copying is its column-grant
   pattern: staff may write `status`/`notes` and never the money or the owner.
5. **6a's fail-open entitlement design already fits.** `identityState` treats a null
   `term_end` as live, and `identitiesDueWithin` excludes it. That is exactly the state a
   paid-but-undelivered card would need under delivery-start terms — kept in reserve should
   D-019's payment-start decision be revisited.
6. **dnd-kit is already a dependency**, chosen in UI-4 for keyboard accessibility, so 6c's
   Kanban needs no new package.

## Files

**New** — `supabase/migrations/0017_orders.sql`, `lib/orders.ts` (+ 27 tests),
`app/dashboard/billing/order-actions.ts`, `components/billing/buy-device.tsx`,
`app/dashboard/orders/page.tsx`

**Modified** — `app/api/mpesa/callback/route.ts` (hardware branch),
`app/dashboard/billing/page.tsx`

## Database (`0017`)

- `staff` (keyed on `auth.users`) + `is_staff()`, SECURITY DEFINER to avoid RLS recursion.
  No write policy: granting staff is a deliberate SQL act, because a table that can grant its
  own membership is a privilege escalation waiting to happen.
- `products` — catalogue metadata, **no price column** (D-018 keeps money in `lib/pricing.ts`).
  Seeded with Smart Card and Smart Stand.
- `orders` — `TT001`-style number from a sequence, `account_id` NOT NULL, `amount_kes`
  recording what was actually charged, twelve fulfilment statuses.
- `order_events` — append-only, written by a **trigger** on insert and on status change, so
  the audit cannot be bypassed. Select-only policy; no insert policy at all.
- `payments.order_id`, nullable — renewals have no order, and every Sprint 4/6a row predates it.
- `provision_identities()` — atomic pool draw via `for update skip locked`, minting the
  shortfall. service_role only.
- `orders_deactivate_on_cancel` trigger — cancelling switches off what the order provisioned.

**Security:** no RLS policy weakened. Customers read their own orders and events; staff read
all. Orders are never client-writable — they are created server-side beside the checkout, so
a client cannot invent an order at a price of its choosing. Column grants stop staff editing
amounts or ownership.

## Tests

438 passing, 39 files (+27). The state machine is covered exhaustively: the happy path end to
end, refusal to skip or reverse stages, the two production loops (revision, QC bounce),
cancellation allowed up to dispatch and never after, no self-transitions, no orphan stages,
and the payment/fulfilment join that stops an unpaid order reading as "Paid". Plus stage
ageing, the stuck-flag's refusal to blame us for customer wait time, and progress.

Typecheck, lint and production build clean.

**Not covered by tests:** the SQL — pool contention under concurrent callbacks, the audit
trigger, and the cancel trigger. All three need a live database; see acceptance.

## Acceptance

1. Apply `0017`.
2. Insert yourself into `staff` (SQL — there is deliberately no UI).
3. Buy a card with a sandbox number. Confirm: an order appears with a `TT` number; the
   payment moves `pending → paid`; **one `nfc_tags` row per unit** appears with a term twelve
   months out; and `order_events` has a row for the creation.
4. **Replay the callback** and confirm no second set of identities is minted.
5. Move the order through a stage in SQL and confirm `order_events` records it with your
   user id.
6. Cancel a paid order and confirm its identities go `disabled` with a null term.

## Deferred to 6c

Staff console shell, `Table` + `Pagination` primitives, orders table with filter/search/sort,
Kanban on dnd-kit, order detail with timeline and token assignment, ops metrics and SLA
flags, the paid-but-cardless reconciliation view, CSV export.

Until 6c ships, fulfilment is advanced by SQL — which is exactly the status quo before this
sprint, so nothing regresses; what changes is that money can now be taken self-serve.
