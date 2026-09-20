# Sprint 8b — Encoding and first tap

**Status:** built, tested, and **applied 2026-09-20** (`0027`, `0028`). First tap verified end
to end against production. **Encoding is NOT yet verified on hardware.**
**Builds on:** D-026, D-030. **Records:** D-031, D-032.

Chips arrive blank. This sprint writes them, and lets the customer's first tap close the order.

---

## 1. Audit — what 8a left unfinished

| # | Finding | Where |
|---|---|---|
| 1 | **Nothing could move a card `received` → `in_stock`.** `receiveBatchAction` set `received`; the only code that ever produced `in_stock` was the one-off LEGACY adoption. A card minted through `/admin/stock` could never become sellable. | `app/admin/stock-actions.ts`, `0021:220` |
| 2 | `encoded_at`, `locked_at`, `encoded_by` existed and were never written by anything. | `0021:118-120` |
| 3 | `first_tap_at` existed, `orders_overview` surfaced it, nothing wrote it. | `0021:121`, `0023:268` |
| 4 | `resolve_tag` carries no order linkage, so the tap path could not tell whether a tap was the first or whether the parcel had shipped. | `0022` |
| 5 | An order sat at `dispatched` until somebody remembered to mark it delivered, so "delivered" recorded a memory rather than an event. | `lib/orders.ts` |

**The finding that shaped the sprint:** there are no cards to encode. Eleven tags exist — four
LEGACY (already encoded years ago) and seven pre-stock-model customer cards. No batch has ever
been minted through `/admin/stock`; nothing is `at_supplier` or `received`. The encode page is
therefore built and unit-tested but **cannot be acceptance-tested until blank cards exist**.

---

## 2. H — `/admin/encode`

**The order of operations is the design, because the last step is irreversible.** Write one
NDEF URL record → read the chip back → compare → lock → record. Locking first, or locking
without reading back, turns a chip that took a mangled write into a permanently dead card that
looks fine until a customer taps it.

**The card identifies itself.** Staff scan the QR on its back or type its serial; we write that
card's own token. Blanks are physically indistinguishable except for the printed serial, so
working down a list in order would be faster and wrong.

**Guards.** `isProductionSiteUrl` permits exactly one host over HTTPS — not localhost, not a
preview URL, not `staging.taptap…` — and the server action re-checks it rather than trusting
the page. The server also recomputes the expected URL from the database rather than accepting
it from the form, and refuses to record a write whose read-back does not match.

**A failed lock is recorded as unlocked**, not claimed as locked. `makeReadOnly()` support is
uneven; a working-but-rewritable card is a real state and the batch list shows the count.

**Refusals** (`encode_card`, mirrored in `encodeBlockedReason` for the message): not `received`,
a placeholder, a stand, already `allocated`, already `defective`.

---

## 3. G — first tap closes the order

`record_first_tap` is **service-role only** and runs from inside `after()`. `log_event` is
granted to `anon` because logging a view is harmless; closing an order is not.

**Idempotent by construction rather than by checking first.** The UPDATE carries
`first_tap_at is null`, so the second tap updates nothing. That is what makes it safe to call
on every tap, which keeps the decision off the hot path — deciding in the application would
mean an extra read to answer a question that is almost always "no".

**Taps before dispatch never count.** Staff test cards, and a test tap must not mark a parcel
delivered that is still on the bench.

The audit trail attributes the move to the customer: `changed_by` is null and the event is
noted "First tap".

---

## 4. Migrations (both applied 2026-09-20)

| File | What it does |
|---|---|
| `0027_card_encoding.sql` | `encode_card()` — the `received → in_stock` transition, with the refusals; `encode_overview()` — per-batch counts in one round trip, because counting a thousand-card batch in the application means shipping every row to do it. |
| `0028_first_tap.sql` | `record_first_tap()` — sets `first_tap_at`, closes a dispatched order, notes the event; `first_tap_notification_target()` — the owner's address and the profile slug for the email. |

---

## 5. Files

**New:** `app/admin/encode/` (page, `encoder.tsx`), `app/admin/encode-actions.ts`,
`components/ops/scanning.tsx`, `lib/notifications/first-tap-email.ts` (+ test),
`lib/notifications/notify-first-tap.ts`, two migrations.

**Changed:** `lib/stock.ts` (`isProductionSiteUrl`, `chipWriteMatches`, `encodeBlockedReason`,
`PRODUCTION_HOST`), `lib/stock.test.ts`, `app/t/[token]/page.tsx` (the `after()` hook),
`components/ops/assign-cards.tsx` (now imports the shared scanner), `app/admin/staff-nav.tsx`.

---

## 6. Verification

`npm test` **53 files, 755 tests** (726 before this sprint). `tsc --noEmit` clean, `eslint .`
clean, `next build` succeeds with `/admin/encode` routed.

**Security, against the live database:** `encode_card` and `record_first_tap` both refuse
`anon` with `42501 permission denied for function`. `record_first_tap` no-ops on a card that is
not allocated.

### First tap — verified end to end in production, 2026-09-20 ✅

A test card (`S-TEST99`, allocated, bound to a dispatched test order) was tapped through the
real production URL:

1. Tap 1 → `307` to `/vgghggg?src=nfc&logged=1`; `first_tap_at` set to `08:36:42`
2. Order moved `dispatched → delivered`
3. `order_events` recorded `First tap` with `changed_by` null — the customer, not a staff member
4. Email sent, Resend id `01a0bdf5-e187-767f-abc2-ee8394a66dd9`
5. **Tap 2 and tap 3 (the latter as `?src=qr`)** left `first_tap_at` unchanged, and the counts
   stayed at exactly one delivered event and one email

Every fixture was deleted afterwards; the database returned to 8 orders and 11 tags.

### Encoding — NOT verified ❌

No blank cards exist, and Web NFC writing needs Chrome on Android against a real chip. When the
supplier delivers:

1. Mint a batch at `/admin/stock`, export the CSV, send it to the supplier
2. When the box arrives, mark the batch received
3. Open `/admin/encode` **on the production site, on an Android phone in Chrome**
4. Turn **test mode on** for the first card, so it is not locked while you learn the flow
5. Scan a card's QR, write it, confirm the read-back matches, then check the card shows as
   encoded with `locked_at` null
6. Turn test mode off and do one for real. Confirm `locked_at` is set and the chip is no longer
   writable
7. Tap the card: it should open its profile. Check `stock_state` is `in_stock` and the batch
   count moved

---

## 7. Risks

- **Encoding is unproven on hardware.** Everything about the flow is right in theory and
  nothing has met a chip. Treat the first batch as a test.
- **Locking is permanent.** Every locked chip points at `taptap.hornbilltech.co.ke/t/…` for the
  life of the card. If that host ever changes, it must keep redirecting forever.
- **`makeReadOnly()` may be unavailable** in some Chrome versions. The card is then recorded
  unlocked and the batch list says so; it is not a failure, but such a card should not ship.
- **The first tap closes the order on a QR scan too.** Somebody photographing the printed QR of
  a dispatched card could mark it delivered before it arrives. Accepted deliberately — the
  brief specifies tap or scan — and the email invites a reply if it has not actually arrived.
- **The notify seam is not built.** `notify(account, kind, payload)` with a WhatsApp channel
  returning `not_configured` was in the brief for 8b and is not here: `notifyDispatched` and
  `notifyFirstTap` are two direct implementations sharing the claim-before-send pattern. Worth
  extracting when a third arrives, not before.

---

## 8. What is NOT in 8b

- **Order mode for stands** (encode a made-to-order token from its order page). The brief lists
  it under H; the encoder is batch-only. No stand has ever been ordered, so nothing is blocked.
- **Premium proof and replacements** (8c), unchanged from 8a's deferral.
