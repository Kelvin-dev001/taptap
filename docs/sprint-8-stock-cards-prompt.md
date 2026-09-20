# Sprint 8 — Stock Cards, Assign-by-Scan & Premium Fronts (brief + Claude Code prompt)

Decisions locked with Kelvin (2026-09-19):

| Question | Decision |
|---|---|
| Who prints | **The supplier prints all cards, in bulk, generic.** It never prints anything customer-specific. Each card carries its own pre-minted token. |
| Card types | **Standard**: both faces printed (Hornbill TapTap front; back = QR + serial + "Tap or scan"). **Premium**: back printed the same way, **front left blank** for us to personalise. |
| Premium at launch | **Yes, both at launch.** |
| Premium front | **Generated from the customer's Tap Profile** on a fixed template → customer approves the proof (or asks for changes) in the dashboard → we print it in-house or at a local ID-card printer. |
| Chip encoding | **In-house.** Build an admin encode page (Chrome on Android, Web NFC) that writes, verifies and locks each chip. |
| Smart Stands | **Stay made-to-order** on the current pipeline. |
| Prices (incl. first 12 months) | Standard Card **KES 1,500** · Premium Card **KES 2,500** · Smart Stand **KES 2,000**. Renewal unchanged: KES 1,000 per identity per year. |
| Delivery | **Rider in Mombasa and Nairobi: free. Upcountry (courier/shuttle): flat fee per order.** Fee amount **not yet set**, prompt uses KES 300 as a placeholder. |
| First-tap message | **Email now** (existing Resend path), WhatsApp later behind a switch. |
| Lost card | **KES 1,000** replacement + delivery. The identity moves to the new card; the old token stops working. |
| Card-first sales (events, agents) | **Later.** Until activation codes exist, nobody can self-claim an unowned card. |

## The three fulfilment paths

| Path | Product | Pipeline | Staff effort |
|---|---|---|---|
| **stock** | Standard Card, Standard replacement | Paid → scan card → packed → dispatched → delivered (first tap) | ~2 min |
| **custom** | Premium Card | Paid → profile chosen → proof → approved → pick blank + scan → print front → QC → dispatched → delivered | print run |
| **made_to_order** | Smart Stand | Unchanged (current 10-stage pipeline); token encoded in-house | as today |

## What the current code collides with (found in the review)

1. **`provision_identities` draws a random unowned token at payment** (0017). With printed stock on the shelf, that binds a card sitting in a drawer to customer A while you ship A a different one.
2. **`claim_tag` lets any paying customer claim any unowned token** (0019). Every stock card shows its QR on the back, so a photo of one would get a free card. And because a tag with no `term_end` is treated as live (D-018 fail-open), it would stay free for good.
3. **`replace_tag` has the same hole.** A customer can "replace" into any unowned token (0010).
4. **`/t/[token]` logs every visit as `nfc`.** The QR on the back of every card would be counted as taps.
5. **The cancel trigger disables whatever the order provisioned.** After assign-by-scan, cancelling would waste a good stock card instead of putting it back in stock.
6. **The admin order page tells staff to "Encode these tokens onto the physical card".** That's wrong for stock cards.
7. **Checkout asks for delivery details only after payment** (a Sprint 7 rule). The delivery fee now depends on the town, so the town has to be asked before the STK push.
8. **Working tree:** `supabase/migrations/0016_renewal_reminders.sql` is **empty** on disk (it's 113 lines in the last commit), and about 80 files show as modified, which looks like line-ending changes. Sort this out before committing anything.

## Things for Kelvin to line up outside the code

- **Set the upcountry delivery fee.** Edit `KES 300` in the prompt before you paste it.
- **Supplier spec:** CR80 PVC (85.6 × 54 mm) with a blank **NTAG213 or larger** chip (the URL is about 70 bytes and NTAG213 holds 144). QR at least 18–20 mm with a quiet zone, the serial printed under it, and "Tap or scan". Two SKUs: Standard (front artwork) and Premium (**front left blank and printable**: glossy PVC with no overlay on that face, so a dye-sub ID-card printer can print on it). Quantities and QR data come from the batch CSV.
- **Locking is permanent.** Every locked chip and printed QR points at `taptap.hornbilltech.co.ke/t/…` for the life of the card. If the domain ever changes, that host has to keep redirecting forever.

## Ready-to-paste Claude Code prompt

```
You are the engineering partner for Hornbill TapTap. Read CLAUDE.md, PROJECT.md and
docs/decision-log.md first, especially D-009 (token identity), D-018 (per-identity
billing), D-019 (the Order is the spine), D-020 (ops console), D-021/D-022 (publish gate,
slot count). We are starting Sprint 8 - Stock Cards. Operate under the repo's sprint
governance: AUDIT -> PLAN -> STOP for my approval before implementing anything.

HOUSEKEEPING FIRST: supabase/migrations/0016_renewal_reminders.sql is empty in the working
tree but has 113 lines at HEAD, and ~80 files show as modified (looks like line endings).
Tell me what these are before touching anything. Do not restore or commit without my OK.

THE BUSINESS CHANGE
Cards are no longer made to order. The supplier prints generic cards in bulk, each with
its own pre-minted token, and never prints anything customer-specific. A customer is linked
to a physical card inside our system when staff scan it at fulfilment. A Standard order
becomes scan, pack, dispatch: about two minutes.

Supplier card types:
- STANDARD: both faces printed. Front = standard Hornbill TapTap design. Back = QR, serial,
  "Tap or scan".
- PREMIUM BLANK: back printed exactly like Standard; FRONT LEFT BLANK. We print the
  customer's name/title/logo on the front in-house after they approve a proof.
- Chips arrive BLANK. We encode and lock them in-house (Phase 8b).
- Smart Stands do NOT change: made-to-order on the current pipeline, token encoded in-house.

LOCKED DECISIONS (do not re-open):
- Prices incl. first 12 months: Standard Card KES 1,500; Premium Card KES 2,500; Smart Stand
  KES 2,000. Renewal KES 1,000 per identity per year for every type (unchanged).
- Delivery: rider delivery in Mombasa and Nairobi is free; any other town adds a flat
  KES 300 per order (courier or shuttle parcel). Cards + delivery = ONE M-Pesa payment.
- Replacement (lost/damaged): KES 1,000 per card + delivery. The identity moves to the new
  card; the old token stops resolving.
- First-tap notification: email via the existing Resend path now; WhatsApp later.
- Premium front: generated from the customer's Tap Profile on a fixed template; customer
  approves or requests changes in the dashboard; staff print it.
- Premium is sold at launch alongside Standard.
- Card-first sales (events, agents, resellers with activation codes) are LATER. Until then
  nobody can self-claim an unowned card.
- Terms still start at payment (D-019). Money stays in lib/pricing.ts (D-018).

AUDIT (read the code, do not assume names) and report. Confirm or refute each collision I
found, and find the ones I missed:
1. provision_identities (0017) draws an arbitrary unowned token at payment. With printed
   stock on the shelf that binds a card in a drawer to a customer who will be shipped a
   different one.
2. claim_tag (latest in 0019) lets any signed-in owner of a published page claim ANY
   unowned token. Every stock card shows its QR, so a photo = a free card, and a tag with
   no term_end is fail-open live (D-018), so it would stay free forever.
3. replace_tag (0010) accepts any unowned token as a "replacement": same hole.
4. app/t/[token]/page.tsx logs every visit as source 'nfc' and redirects with ?src=nfc to
   mean "already logged". The printed QR needs its own source without double-logging.
5. deactivate_cancelled_order_identities disables what an order provisioned; after a stock
   card is bound it would burn a good card instead of returning it to stock.
6. app/admin/orders/[id]/page.tsx tells staff to "Encode these tokens onto the physical
   card".
7. Checkout collects delivery after payment (Sprint 7 rule); the fee now depends on town.
8. Every consumer of nfc_tags (devices page + actions, get_devices_overview, per-card
   analytics, ops_overview's paid-but-cardless list, billing identity list, renewal cron,
   /print/qr, entitlement/slot counting): how does each treat an identity that has no
   physical card yet?
9. Legacy unowned tokens minted via /admin/mint: how many exist. Ask me whether physical
   cards encoded with them exist.

THE MODEL (recommended design; if the audit shows a simpler shape with the same guarantees,
propose it in the plan):

A. Stock inventory
- card_batches: code, variant (standard|premium), quantity, supplier, notes, created_by,
  created_at, received_at.
- nfc_tags gains: batch_id, serial (unique, short, human-readable, printed on the card,
  readable over the phone, e.g. S-000123 / P-000045, never derivable into the token),
  variant, stock_state (at_supplier -> received -> in_stock -> allocated; defective from any
  pre-allocation state), encoded_at, locked_at, encoded_by, first_tap_at.
- Keep nfc_tags.status (unassigned/assigned/disabled) meaning exactly what it means today.
  Stock state is a separate axis. Do not overload status, for the same reason D-019 kept
  fulfilment and payment apart.
- /admin/stock replaces /admin/mint (ADMIN_TOKEN stays the second factor on minting, D-020):
  mint a batch (variant + quantity, cap 1,000) -> tags in at_supplier; batch list with
  "Mark received"; counts by variant x state; mark a card defective with a reason; warn when
  in_stock for a variant drops below 10. Spares are just in_stock cards, no extra state.
- CSV export per batch (staff only): batch, serial, variant, qr_url. qr_url = the card's
  /t/<token> URL WITH a QR marker (e.g. ?src=qr). The chip is encoded with the plain
  /t/<token> URL. This CSV is what the supplier prints from.
- Migration adopts existing unowned, non-disabled legacy tokens into a LEGACY batch
  (standard, in_stock, serials assigned) so any already-encoded physical card stays
  assignable (by NFC read, as it has no printed QR).

B. Payment provisions a placeholder; the scan moves it onto a real card
- products gain a fulfilment path: stock (smart_card), custom (new smart_card_premium),
  made_to_order (smart_stand).
- For stock/custom products provision_identities mints PLACEHOLDER identities: nfc_tags rows
  whose token is never printed or encoded, flagged as placeholders, carrying account, kind,
  term and (optionally) the page the card will open. They count as live identities for the
  slot count exactly as today, so the customer can publish the moment they pay (D-022). For
  made_to_order it mints real tokens to encode, as now. REMOVE the unowned-pool draw from
  provision_identities entirely. Placeholder tokens never resolve at /t/.
- Recommended: an order_units table, one row per physical unit (order_id, index,
  placeholder_tag_id, tag_id once bound, plus the premium proof fields in I). It records
  which card fulfilled which unit and holds premium proofs.
- ONE atomic, staff-only SECURITY DEFINER function moves an identity onto a physical card
  (used for new orders AND replacements). It locks both rows FOR UPDATE and refuses: card not
  in_stock, wrong variant for the order, already allocated (name the order), defective,
  stand token. It copies account_id, kind, term_start, term_end, smart_page_id, label,
  claimed_at onto the stock card; sets it allocated; disables the source (placeholder or
  lost card) with superseded_by; REPOINTS payment_tags from source to the stock card so
  renewals and the cancel trigger follow the identity; updates the unit. The live-identity
  count must be identical before and after.
- If the source has no page and the account has exactly one published page, bind to it.
  Otherwise leave it unbound and warn staff on the order ("Customer hasn't chosen a profile
  for this card; it will ask them to link it on first tap"). Do not block dispatch on it.
- Cancelling before dispatch RETURNS a bound stock card to in_stock (clear account, term,
  page, label) and disables the identity. Cancelling after dispatch stays impossible.

C. Assign by scan (/admin/orders/[id])
- Replace the "Encode these tokens" block with an Assign cards panel, one slot per unit.
  Staff scan the printed QR with the phone camera (native BarcodeDetector), OR tap the card
  to the phone (Web NFC read on Chrome Android; also the only way to assign legacy cards),
  OR type the serial. Parse the token from a scanned URL tolerating ?src and trailing
  slashes. Ask me before adding a scanning library.
- Each scan shows serial, variant, "TT012, unit 1 of 2", with Undo until dispatch (card back
  to in_stock, placeholder restored).
- Assigning requires the order to be PAID (reuse the existing gate; remember TT004).
- The last scan on a stock-path order moves it to ready_for_dispatch automatically.
- Packing slip at /print/packing-slip/[orderId] (follow /print/receipt): order number,
  recipient, phone, town/area, delivery method, serials in the parcel, and the insert text:
  "Android: tap the back of your phone. iPhone: tap near the top. No NFC? Scan the QR."
- Mark dispatched asks: via (rider / courier / shuttle), reference (rider name and phone,
  or waybill number), optional note. Customer gets an "on its way" email with the reference.

D. Fulfilment paths (lib/orders.ts)
Transitions become path-dependent. Keep one function that the UI and the server action
both use (as transitionBlockedReason does now), keep the pure/tested split and the DB audit
trigger.
- stock: new -> ready_for_dispatch -> dispatched -> delivered. No content/design/approval/
  production/qc: the card was tested when it was encoded.
- custom: new -> content_received -> design -> awaiting_approval -> (approved |
  revision_requested -> design) -> in_production -> qc -> ready_for_dispatch -> dispatched
  -> delivered. Blanks are scanned during in_production (pick the blank, scan, print its
  front).
- made_to_order: unchanged.
- Every path: ready_for_dispatch requires every unit bound (stands: every token encoded).
  Enforced in the server action, not only hidden in the UI.
- Stuck rules per path: a paid stock order unassigned for 2+ days is stuck; custom and
  made_to_order keep 5. Dispatched with no first tap after 7 days goes on an ops follow-up
  list (waiting on the customer, so not "stuck").
- Customer-facing labels per path (stock: Paid -> Packed -> On its way -> Delivered).

E. Checkout and pricing
- Product choice: Standard Card, Premium Card, Smart Stand. Premium, in one line: "Your
  name, title and logo printed on the front. You approve a proof before we print."
- Delivery is asked BEFORE payment because it changes the amount (revises Sprint 7's rule).
  Keep it short: Where should we deliver? Mombasa / Nairobi / Another town (then town,
  required). Recipient name and phone prefilled. Area or landmark optional. Notes optional.
  The customer can correct these from their order page until it is dispatched.
- Screen total = cards + delivery; the server recomputes from lib/pricing.ts.
  orders.amount_kes stays the total charged; store the delivery fee separately so the
  receipt itemises it.
- lib/pricing.ts: price by product (Standard and Premium are both kind 'card'), delivery
  fee, replacement fee. Update every place a price shows (grep 1,500 and
  HARDWARE_PRICE_KES: pricing page, pricing teaser, landing, buy-device, activate-dialog,
  quote page, checkout). Checkout success page: "what happens next" per path.
- Staff "record offline payment" already takes a reference: label it "M-Pesa receipt code
  or bank reference". It must keep settling through settlePayment.

F. Tap handling (/t/[token])
- Unowned stock card: no claim form. Show a warm "This TapTap card hasn't been activated
  yet" page with a link to get one.
- Owned but unbound card: the signed-in owner can link it to one of their published pages
  (existing claim form, own cards only); anyone else sees "This card isn't set up yet".
- claim_tag refuses any tag with account_id null. replace_tag refuses tokens not already
  owned by the caller's account (lost-card replacement becomes an order, see J). Test both
  in the lib/publish-enforcement.test.ts style.
- A card-QR scan (?src=qr) logs ONCE as a scan with source 'qr' and the tag_id; a chip tap
  logs ONCE as 'nfc'. Make sure the slug route does not log the QR scan a second time.

G. First tap = delivery confirmation (Phase 8b)
- The first tap or card-QR scan of an allocated card AFTER its order is dispatched: set
  first_tap_at once (atomic, WHERE first_tap_at IS NULL), move the order dispatched ->
  delivered (order_events note "First tap", actor null = system), and email the owner.
  Subject: "Your TapTap card is live". Body: "Your card just got its first tap. You're
  live." plus a link to their analytics. Taps before dispatch (staff testing) log normally
  and never count.
- Dedupe via notification_deliveries (0014) the way lib/notifications/notify-lead.ts and
  notify-renewals.ts do, so two taps in the same second send one email, and follow them for
  finding the owner's email. Never slow the tap path: after() or the DB, never before the
  redirect.
- A small seam: notify(account, 'first_tap' | 'dispatched', payload), email implemented, a
  WhatsApp channel that returns not_configured unless its env vars exist. Integrate NO
  WhatsApp provider this sprint.
- Staff can still mark delivered by hand.

H. In-house encoding (/admin/encode, Phase 8b): Chrome on Android, Web NFC
- Batch mode: pick a received batch; per card: scan its printed QR (camera) to identify the
  token -> "Hold the card to the back of the phone" -> write ONE NDEF URL record = the plain
  /t/<token> URL -> read back and compare -> lock (makeReadOnly) -> mark in_stock with
  encoded_at, locked_at, encoded_by. A test-mode toggle skips the lock. Mismatch or failure
  -> retry or mark defective. Progress x/N, resumable. Serial entry if the camera fails.
- Order mode for stands: encode that order's token (write, verify, lock, record
  encoded_at).
- Unsupported browser: say it needs Chrome on Android over HTTPS, and stop. Check
  makeReadOnly against current Web NFC docs; if unavailable, record the chip as unlocked
  and say so.
- Locking is permanent. Refuse to encode unless NEXT_PUBLIC_SITE_URL is the production
  domain (never localhost or a preview URL).

I. Premium proof (Phase 8c)
- After payment the Premium order page asks, per unit, which Tap Profile goes on this
  card's front (default: their only profile). That profile is also the page the card
  opens.
- Proof = one fixed CR80 template (85.6 x 54 mm, 3 mm safe margin): logo, name, title,
  business name, the profile's accent colour; text auto-fits within line limits; no Hornbill
  branding on the front. Render it live in the dashboard, and as staff print output: a print
  page at exact CR80 size plus a 300-dpi PNG (1011 x 638 px). Reuse next/og as
  app/[slug]/opengraph-image.tsx does rather than adding a renderer.
- Customer sees "Ready for your approval": Approve, or Request changes with a note.
  Approving freezes a snapshot (text + a copy of the logo) so later profile edits never
  change what gets printed. Approval requires the profile to be published (the card must
  work on arrival). The order_events trigger uses auth.uid(): make sure the CUSTOMER is
  recorded as the actor of their approval, not null.
- Staff can override fields on a unit and resend the proof. The order moves to approved
  when every unit is approved.

J. Replacement (Phase 8c)
- /dashboard/devices: "Lost or damaged? Replace this card" -> checkout (KES 1,000 +
  delivery) -> an order of kind replacement that references the lost card and provisions NO
  new identity (the billing unit is the identity, not the plastic, D-018).
- Standard replacement follows the stock path; Premium replacement reuses the approved
  snapshot and starts at approved.
- At bind, the move function from B transfers the identity from the lost card. The
  customer's page must stay live throughout: check how disabling a tag affects the slot
  count (D-022) before offering "switch the lost card off now".

PHASES. Each ends with tests + typecheck + build green, a sprint doc in docs/, decision-log
entries mirrored into PROJECT.md, and a STOP for my review. Write migrations (0020 onward)
but do NOT apply them; tell me exactly which to run and the SQL checks to run after.
- 8a Stock model: A, B, C, D (stock + made_to_order), E (Standard, Stand, delivery), F.
  Needed before the first stock card ships.
- 8b Encoding + first tap: H, G.
- 8c Premium + replacements: I, J, D custom path, Premium in checkout and pricing.

DECISIONS TO RECORD (propose wording in the plan):
- D-025 Cards are stock, not made-to-order: identity is a placeholder at payment and moves
  onto a physical card at assignment; the unowned-pool draw is removed (revises D-019).
- D-026 Unowned cards cannot be self-claimed until activation codes exist (revises D-009's
  claim flow).
- D-027 Delivery is priced at checkout (revises Sprint 7's collect-after-payment rule).
- D-028 The first tap after dispatch closes the order.
- D-029 Premium = a custom front on a stock blank; proof from the profile, frozen at
  approval.

TESTS: path-dependent transitions for every path (unbound units block ready_for_dispatch;
unpaid blocks assignment); pricing (each product, delivery, replacement, totals); serial
format; token parsing from scanned URLs; batch CSV; stuck rules per path; customer labels
per path; proof text-fitting; claim/replace refusing unowned cards. The SQL needs a live DB,
so put an acceptance script in the sprint doc: mint batch -> export CSV -> receive ->
encode -> pay -> placeholder counts as live and a page can publish -> scan assigns and
payment_tags follows -> replay the callback, nothing new minted -> cancel before dispatch
returns the card to stock -> dispatch -> first tap delivers + exactly one email -> tap
again, no second email.

NON-FUNCTIONAL: reuse the design system; ONE payment path (settlePayment); weaken no RLS
policy; admin routes stay behind the existing requireStaff layout; no em dashes in customer
copy (docs/landing-page-copy.md; the marketing test enforces it); Magangi's existing claimed
cards must behave exactly as today (test it explicitly); renewal pricing unchanged.

Follow AUDIT -> PLAN -> STOP. The plan must show: the migration outline, the exact
move-identity function, how the live-identity count stays constant across a move, and how
each existing nfc_tags consumer treats a placeholder. Wait for my approval before building.
```
