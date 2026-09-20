# Sprint 8a — Stock cards, placeholders and assign-by-scan

**Status:** built, tested, and **applied 2026-09-20** (`0020`–`0025`), verified read-only against
the live database. Completed 2026-09-20 with dispatch capture, customer delivery editing and
per-path checkout copy; `0026` is written and **not yet applied**.
**Builds on:** D-018, D-019, D-021, D-022. **Records:** D-025 … D-030.

Cards stop being made to order. A supplier prints them generically in bulk, each carrying its
own pre-minted token, a printed serial and a QR; they sit on a shelf; a customer is joined to
one when staff scan it at fulfilment. A Standard order becomes scan, pack, dispatch.

---

## 1. Audit — what the old code collided with

Every collision in the brief was confirmed in the code, and two more were found.

| # | Finding | Where |
|---|---|---|
| 1 | `provision_identities` draws an arbitrary unowned token at payment. With printed stock on a shelf this binds a card in a drawer to a customer who will be posted a different one. | `0017:256-275` |
| 2 | `claim_tag` accepts any tag whose `account_id` is null. Every stock card prints its QR, so a photograph of one in a display case was a free card — permanently, because a tag with no `term_end` is live forever. | `0019:330`, `0015:128` |
| 3 | `replace_tag` has the same hole, **and never copied `term_start`/`term_end`**, so a replacement landed with a term that never expires. A live billing hole, not just a Sprint 8 obstacle. | `0010:198-215` |
| 4 | `/t/[token]` logs every visit as `nfc`. The printed QR would have been counted as hardware taps — the fabrication §15 forbids. | `app/t/[token]/page.tsx` |
| 5 | The cancel trigger disables whatever an order provisioned. After assign-by-scan that burns a printed, encoded, locked card. | `0017:314-334` |
| 6 | The order page told staff to "Encode these tokens onto the physical cards". Wrong for stock. | `app/admin/orders/[id]/page.tsx:135-182` |
| 7 | Checkout collects delivery after payment (Sprint 7). The fee now depends on the town. | `app/dashboard/checkout/actions.ts:44` |
| **8** | **`nfc_tags` never got column-level UPDATE grants.** A customer could `PATCH` their own `term_end` and defeat billing, grace and the slot count in one request. Fixed separately as `0020`. | `0005:28-33` |
| **9** | **`payment_tags` was written in a separate round trip from minting.** A crash between them left identities with no payment link, silently breaking renewals and the cancel trigger. | `lib/provisioning.ts:101-137` |

Two further notes that shaped the build: `ops_overview` (`0018:120-142`) hand-copies the
live-identity predicate rather than calling `account_live_identities`, so it will need updating
in lockstep if that predicate ever moves; and `orders_overview` could only be extended by
**appending** columns, since `create or replace view` cannot reorder or rename them.

---

## 2. The model

**Two axes, never one.** `nfc_tags.status` (unassigned / assigned / disabled) keeps exactly the
meaning it has had since 0005 — it is about the IDENTITY. `stock_state` (at_supplier → received
→ in_stock → allocated, plus defective) is about the PLASTIC. A card can be `in_stock` owned by
nobody, and an identity can be `assigned` with no plastic at all. Collapsing them would repeat
the mistake D-019 avoided when it kept fulfilment and payment apart.

**Payment mints a placeholder.** A real, billable, publishable identity whose token is never
printed and never encoded. The customer can publish the moment they pay (D-022) while the shelf
stays untouched. `resolve_tag` returns null for a placeholder, so one never resolves at `/t/`.

**The scan moves the identity onto the plastic.** `bind_order_unit` locks both rows, refuses a
card that is not in stock / wrong variant / already allocated / defective / a stand, copies the
account, kind, term, page, label and claim date onto the card, disables the source with
`superseded_by`, and **repoints `payment_tags`** so renewals and the cancel trigger follow the
identity. It reads `account_live_identities` before and after and **raises if the number moved** —
the invariant is the point of the function, so it is executable rather than a comment.

**Cancelling returns the card to stock** rather than burning it, and deletes the `payment_tags`
rows so a replayed renewal cannot extend a card sitting on a shelf.

---

## 3. Migrations (`0020`–`0025` applied 2026-09-20; `0026` pending)

| File | What it does |
|---|---|
| `0020_nfc_tags_column_grants.sql` | The hotfix. `revoke insert, update, delete` / `grant update (label)`; `rebind_tag()`, `set_tag_status()`; `replace_tag` carries the term. See `docs/hotfix-0020-nfc-tags-grants.md`. |
| `0021_stock_inventory.sql` | `card_batches`; eleven columns on `nfc_tags`; serial sequence + `next_card_serial()`; a staff SELECT policy on `nfc_tags`; LEGACY batch adoption; `stock_overview()`. |
| `0022_stock_provisioning.sql` | `products.fulfilment_path` / `provisions_identity` / `variant` + Premium and replacement SKUs; `order_units` (including the 8c proof columns); `provision_order()` replacing `provision_identities()`; `resolve_tag` hides placeholders and distinguishes unactivated; `bind_order_unit()` / `unbind_order_unit()`; the rewritten cancel trigger; `claim_tag` and `replace_tag` locked down. |
| `0023_delivery.sql` | `delivery_rates`; delivery and dispatch columns on `orders`; `update_order_delivery()`; `record_dispatch()`; `orders_overview` extended by appending. |
| `0024_legacy_batch_received.sql` | Marks the LEGACY batch received, so it stops badging "At supplier" while its cards sit on the shelf. |
| `0025_terms_for_untermed_identities.sql` | Gives a term (ending 31 Dec 2026) to the four claimed, actively-used identities that carried `term_end = NULL` and were therefore live forever and never billed. |
| `0026_dispatch_notification.sql` | **NOT YET APPLIED.** `dispatch_notification_target()`: one SECURITY DEFINER read returning the owner's address and the parcel's facts, so the "on its way" email has a recipient. Returns nothing for an order that has not been dispatched. |

**Applied in order on 2026-09-20**, `0020` first and alone.

**`provision_identities` is dropped.** A function that still exists is one something can still
call, and this one hands out physical cards nobody has picked up. Rolling back means recreating
it from `0017`.

---

## 4. Files

**New:** `lib/stock.ts`, `lib/stock.test.ts`, `lib/tag-write-enforcement.test.ts`,
`app/admin/stock/` (page, `mint-batch.tsx`, `batch-actions.tsx`), `app/admin/stock-actions.ts`,
`app/api/admin/stock/csv/route.ts`, `app/print/packing-slip/page.tsx`,
`components/ops/assign-cards.tsx`, four migrations, `docs/hotfix-0020-nfc-tags-grants.md`.

**New in the completion pass:** `components/ops/dispatch-order.tsx`,
`app/dashboard/orders/actions.ts`, `app/dashboard/orders/delivery-details.tsx`,
`lib/notifications/dispatch-email.ts`, `lib/notifications/dispatch-email.test.ts`,
`lib/notifications/notify-dispatch.ts`, `supabase/migrations/0026_dispatch_notification.sql`.

**Changed:** `lib/pricing.ts` (product catalogue, delivery, totals), `lib/orders.ts`
(path-dependent transitions, binding gate, per-path stuck thresholds and labels),
`lib/provisioning.ts` (one atomic call), `app/admin/order-actions.ts` (assign/unassign),
`app/admin/orders/[id]/page.tsx`, `app/dashboard/checkout/` (form, page, actions, success),
`app/t/[token]/page.tsx`, `app/[slug]/page.tsx`, `app/dashboard/devices/actions.ts`,
`components/ops/advance-order.tsx`, the board/list/CSV/dashboard order surfaces,
`app/admin/staff-nav.tsx`.

**Deleted:** `app/admin/mint/` and `app/admin/actions.ts`. `mintTagsAction` produced loose
tokens with no batch, no serial and no stock state — cards outside the model this sprint builds.

---

## 5. Verification

`npm test` **52 files, 726 tests, all passing** (700 at the first cut of this sprint, 632 before
it, 611 before the hotfix).
`tsc --noEmit` clean. `eslint .` clean. `next build` succeeds; `/admin/stock`,
`/api/admin/stock/csv` and `/print/packing-slip` all built, `/admin/mint` gone.

**A bug the tests caught:** the first `orders_overview` redefinition inserted new columns in the
middle of the select list. `create or replace view` can only append — it cannot reorder, rename
or drop — so that would have failed at apply time, halfway through a production migration.

**A lint rule that caught a real problem:** feature-detecting `BarcodeDetector` and `NDEFReader`
with `setState` inside an effect triggers cascading renders. Both now use `useSyncExternalStore`
with a server snapshot of `false`, which is also hydration-safe.

### Acceptance script (needs a live database)

1. Mint a batch at `/admin/stock` → cards land `at_supplier`, serials assigned.
2. Export the CSV → one row per card, `qr_url` carries `?src=qr`.
3. Mark received → `at_supplier` rows become `received`. Still not sellable.
4. Set `stock_state = 'in_stock'` by hand for now (the encode page is 8b).
5. Pay for a Standard card → a placeholder identity exists, `account_live_identities` counts it,
   and a draft page can be published.
6. Scan a card onto the unit → `payment_tags` follows the identity, the placeholder is disabled
   with `superseded_by` set, and the live count is unchanged. The order moves to
   `ready_for_dispatch` on the last scan.
7. Replay the M-Pesa callback → nothing new is minted.
8. Cancel before dispatch → the card returns to `in_stock` with nothing of the customer's on it.
9. Check `select count(*) from nfc_tags where stock_state='in_stock' and account_id is not null`
   returns **0** — a card on the shelf must never carry an owner.
10. Dispatch it: the order page asks the method and reference, `orders.dispatch_method`,
    `dispatch_reference` and `dispatched_at` are written, and the customer's order page shows the
    reference in place of the address form.
11. Try to move an order to `dispatched` from the board: there is no such button, only a link to
    the order page, and a hand-posted transition is refused.
12. Check exactly one row in `notification_deliveries` with `kind='dispatched'` for that order,
    and that marking it dispatched again adds none.
13. Edit the delivery details on `/dashboard/orders` before dispatch (saves) and after it
    (refused with "already gone out").

---

## 6. What is NOT in 8a

Deferred deliberately, and named so nobody assumes otherwise:

- **`/admin/encode`** (8b). Chips arrive blank and there is no in-app way to write them yet, so
  step 4 above is manual. **This is the gap between 8a and shipping a stock card.**
- **First tap closing the order** (8b). `first_tap_at` and `orders_overview.first_tap_at` exist
  and are never written.
- **Premium proof** (8c). Premium sells today and staff produce the front by hand, as agreed.
  `order_units` already carries the proof columns.
- **Replacement checkout** (8c). The SKUs, `orders.replaces_tag_id` and the bind path all exist;
  there is no button on `/dashboard/devices` yet.
- ~~**Dispatch UI.**~~ **Built 2026-09-20 (D-030).** `/admin/orders/[id]` asks how the parcel is
  going and who has it, `record_dispatch()` stores it, and `advanceOrderAction` **refuses** a bare
  move to `dispatched` so no surface can skip the capture. The board links to the order page
  instead of offering the move. The customer is emailed the reference once, idempotently, through
  the existing Resend path. **Needs `0026` applied before the email can find a recipient.**
- ~~**Customer delivery editing.**~~ **Built 2026-09-20.** `/dashboard/orders` shows where the
  parcel is going and lets the customer correct the recipient, phone, town, area and notes until
  it ships, through `update_order_delivery()`. Once dispatched the form is replaced by the
  method and reference. The zone stays fixed: it set the price that was charged.
- **Premium on the marketing surfaces.** The pricing page, landing teaser, buy-device chooser,
  activate dialog and quote page still show Standard and Stand only. They read
  `HARDWARE_PRICE_KES`, which is now derived from the catalogue, so nothing is wrong — it is
  incomplete.
- ~~**Checkout success copy per path.**~~ **Built 2026-09-20.** `checkoutNextSteps(path)` in
  `lib/orders.ts`, tested. The old copy promised every buyer "we will contact you about artwork",
  which was a lie to anyone buying a card already printed and sitting on a shelf.

---

## 7. Risks

- ~~**`0016_renewal_reminders.sql` is empty on disk.**~~ **Settled 2026-09-20.** Restored from
  HEAD before committing. Committing it as it stood would have deleted 113 lines of an applied
  production migration, and a rebuild from migrations would then have silently omitted renewal
  reminders. Nothing else in the working tree was line-ending noise: the other 26 files were the
  sprint's real work.
- **`0026_dispatch_notification.sql` is not applied.** Until it is, marking an order dispatched
  records and displays the method and reference normally, and the email is skipped. The skip is
  recorded rather than swallowed, and `notifyDispatched` never throws, so the dispatch itself
  cannot fail because of it.
- ~~The legacy adoption is unverified against reality.~~ **Settled 2026-09-20.** Four tokens were
  adopted as `S-000001`–`S-000004`, and Kelvin confirmed four real encoded cards exist for them.
  They carry no printed QR or serial, so the NFC tap path in the assign panel is the only way to
  scan them onto an order.
- **Four identities were live forever and never billed** — found by the post-migration
  verification, not by the audit. `/yassir`, `/dingo-mca-tononoka-2017`, `/kreto` and `/kenaru`,
  all self-claimed through the hole D-027 closed, all actively tapped, none with a payment row.
  `0025` gives them a term ending 31 December 2026. **They have not been told.**
- **`ops_overview` hand-copies the live predicate** (`0018:120-142`). Placeholders will appear in
  its counts; it was not updated this sprint.
- **Locking a chip is permanent.** Every printed QR and locked chip points at
  `taptap.hornbilltech.co.ke/t/…` for the life of the card.
- **Magangi's three claimed cards** are unaffected by design — they are owned, so the legacy
  adoption skips them — but this has not been confirmed against the live database.
