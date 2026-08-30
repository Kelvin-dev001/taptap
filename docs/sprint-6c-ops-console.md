# Sprint 6c — Operations console

**Status:** built, awaiting migration `0018` + acceptance · **Date:** 2026-08-30 · **Decision:** D-020

The internal half of Sprint 6. 6b made hardware buyable and left fulfilment to be advanced by
hand in SQL; this makes it a job someone can actually do.

---

## ⚠ Run this before deploying

The whole `/admin` area now requires a row in `staff`. There is deliberately no UI to grant
it — a table that can grant its own membership is a privilege escalation. **Without this you
lock yourself out of card minting:**

```sql
insert into public.staff (user_id, role)
select id, 'admin' from auth.users where email = 'kelvinoyugi101@gmail.com'
on conflict (user_id) do nothing;
```

Apply `0018` first, then this, then deploy.

---

## What staff can now do

- **/admin** — what needs attention: open orders, unpaid orders, stuck work, renewals due,
  lapsed identities, blank cards left in the pool, and the accounts still needing
  reconciliation from D-018.
- **/admin/orders** — every order, filtered by stage and payment, searchable by number,
  business or contact, sortable and paginated. CSV export honours the filters.
- **/admin/orders/[id]** — the full picture: legal moves, provisioned cards with their tokens
  and terms, payment references, the `order_events` timeline, and free-text notes.
- **/admin/board** — columns by stage with ageing and stuck flags; cards advance by button.
- **/admin/mint** — unchanged, now behind staff auth with `ADMIN_TOKEN` as a second factor.

## The decision worth knowing about

**The board does not use drag-and-drop**, and that is the accessible choice rather than the
cheap one. Transitions are constrained, so most drops would have to be refused — an
interaction whose answer is usually "no" is a bad one. Rendering only the moves
`allowedTransitions()` permits makes an illegal move unreachable instead of rejected, and it
works identically with a keyboard, a screen reader and a mouse (§24). See D-020.

## Files

**New** — `supabase/migrations/0018_ops_console.sql`, `lib/staff.ts`,
`components/ui/table.tsx` + `pagination.tsx` (+16 tests), `components/ops/advance-order.tsx`
(+8 tests), `app/admin/layout.tsx`, `staff-nav.tsx`, `page.tsx`, `order-actions.ts`,
`orders/page.tsx`, `orders/order-filters.tsx`, `orders/[id]/page.tsx` + `order-notes.tsx`,
`board/page.tsx`, `app/api/admin/orders/csv/route.ts`

**Moved** — the mint form from `/admin` to `/admin/mint`, so `/admin` can be the overview.

## Database (`0018`)

- `orders_overview` — orders joined to business, product, the winning payment status and the
  count of identities actually provisioned. **`security_invoker = true`** is load-bearing:
  without it the view runs as its owner and bypasses RLS, exposing every customer's orders to
  every signed-in user.
- `ops_overview()` — the aggregates that need the database, staff-gated with an explicit
  `is_staff()` check because SECURITY DEFINER reads across every account. Raising beats
  returning empty: a silent empty dashboard looks like a quiet week rather than a permissions
  fault.

Stage counts and stuck flags are **not** in SQL — they come from the tested `isStuck()` over
the bounded set of open orders, so the rule has one definition.

## Tests

462 passing, 42 files (+24). Table semantics and `aria-sort`; pagination range maths, clamping
and the removal — not disabling — of unavailable directions; and the board's central claim,
that only legal moves are ever offered, including the revision loop, the QC bounce, and the
refusal to offer cancellation after dispatch.

Typecheck, lint and production build clean.

**Not covered by tests:** the view's `security_invoker` behaviour and `ops_overview`'s staff
gate. Both need a live database — see acceptance.

## Acceptance

1. Apply `0018`, then run the `staff` insert above.
2. Open `/admin` as yourself — you should see the console. Open it **signed in as a
   non-staff account** and confirm you are redirected to `/dashboard`.
3. Hit `/api/admin/orders/csv` as a non-staff signed-in user and confirm a 403.
4. **The one that matters:** query `orders_overview` as a normal customer and confirm you see
   only your own orders. If `security_invoker` did not take, this leaks everything.
5. Advance an order through a stage and confirm the timeline records it against your user.
6. Try an illegal move by posting a bad `to` value and confirm it is refused.

## Deferred

Assigning or replacing a specific token on an order from the console — provisioning picks
from the pool automatically, and swapping a card is rare enough to stay a SQL job until
someone actually needs it. Bulk actions across selected orders, likewise, until the volume
justifies them.
