# Sprint 8c — Premium proof and replacements

**Status:** built, tested, and **applied 2026-09-20** (`0029`). **Not exercised by a real
customer:** no Premium card has ever been ordered.
**Builds on:** D-026, D-029. **Records:** D-033.

Premium has sold since 8a with staff producing the front by hand. This automates it, and makes
a lost card replaceable by buying one.

---

## 1. Audit — what 8a had already built

8a did more than its own doc claimed, which shortened this sprint considerably:

| Already there | Where |
|---|---|
| Every proof column on `order_units`, with a CHECK constraint on `proof_status` | `0022:115-134` |
| `provision_order` sets `proof_status = 'pending'` for custom-path units | `0022:246` |
| `source_tag_id` wired to `orders.replaces_tag_id` for non-provisioning products | `0022:244` |
| Both replacement SKUs, priced, `provisionsIdentity: false` | `lib/pricing.ts` |
| Premium sellable and in the checkout chooser | `SELLABLE_PRODUCTS` |
| The `custom` path walking the full pipeline | `PIPELINE_BY_PATH` |

**What was missing:** everything the customer touches, the print output, the replacement
purchase, and Premium on two surfaces that kept their own copy of the catalogue.

---

## 2. I — the proof

**One renderer, used three times.** `components/proof/card-front.tsx` drives the customer's
preview, the print page and the 300dpi PNG. If the preview and the print came from different
code, the customer would be approving something other than what gets made, and they would find
out when it arrived. It is written in the subset of CSS Satori understands so `next/og` can
render it, exactly as `app/[slug]/opengraph-image.tsx` does.

**Approval freezes a snapshot.** A customer approves a specific card; if they later rename the
profile or swap the logo, the card already in production must not silently change. The print
surfaces read `proof_snapshot` and never the live profile, and the panel says so.

**Approval requires the profile to be published** (D-021). Printing a name onto plastic that
opens a draft nobody can see is a card dead on arrival.

**Every proof function runs as the customer**, not the service role, because the `order_events`
trigger stamps `changed_by` from `auth.uid()`. The approval is the one event in the whole
pipeline that is genuinely theirs.

**Text fitting is character-based, not measured.** The same answer has to come out in a browser,
a print page and Satori, and only one of those can measure a font. An approximation that is
identical everywhere beats an exact measurement that differs between the proof and the print.
Truncation is reported so the UI warns rather than surprising anyone.

---

## 3. J — replacements

Buying one replaces the old "enter a spare card's code" flow as the primary path; that flow is
demoted rather than deleted, because since D-027 it only helps a customer who already owns a
spare, which is rare but real.

**The SKU is derived from the lost card, never posted with the form.** A Premium replacement has
to be Premium: its front is printed with artwork the customer already approved, and letting the
form name the product would let somebody pay for a Standard replacement of a Premium card and
receive something that is not what they lost. Quantity is forced to one for the same reason.

No new identity is minted — `provision_order` already knew that, because the billing unit is the
identity and not the plastic (D-018). The remaining term carries over.

---

## 4. The catalogue bug this uncovered

`components/billing/buy-device.tsx` and `app/pricing/page.tsx` each kept **their own list of
products**, which is why Premium was invisible on both. Worse, the billing chooser priced by
`HARDWARE_PRICE_KES[kind]`, and Premium is kind `card` — so a Premium card would have been
advertised at **KES 1,500** and charged at KES 2,500. Both now map `SELLABLE_PRODUCTS` and read
`priceKes`, so `lib/pricing.ts` is the only list of what we sell and what it costs (D-018).

---

## 5. Migration (applied 2026-09-20)

| File | What it does |
|---|---|
| `0029_premium_proof.sql` | `set_unit_proof_page()`, `approve_unit_proof()`, `request_unit_revision()` — all running as the customer; `resend_unit_proof()` for staff; `order_unit_proofs`, a `security_invoker` view so one read serves the unit, its profile and whether that profile is published. |

---

## 6. Files

**New:** `lib/proof.ts` (+ test), `components/proof/card-front.tsx`,
`app/dashboard/orders/proof-panel.tsx`, `app/dashboard/orders/proof-actions.ts`,
`components/ops/order-proofs.tsx`, `app/print/proof/page.tsx`, `app/api/proof/[unitId]/route.tsx`,
`supabase/migrations/0029_premium_proof.sql`.

**Changed:** `lib/pricing.ts` (`replacementProductFor`), `app/dashboard/checkout/`
(actions, form, page), `components/devices/device-card.tsx`, `components/billing/buy-device.tsx`,
`app/pricing/page.tsx`, `app/admin/order-actions.ts`, `app/admin/orders/[id]/page.tsx`,
`app/dashboard/orders/page.tsx`.

---

## 7. Verification

`npm test` **54 files, 787 tests** (755 before this sprint). `tsc --noEmit` clean, `eslint .`
clean, `next build` succeeds with `/print/proof` and `/api/proof/[unitId]` routed.

**Security, against the live database:** all four proof RPCs refuse `anon` with
`42501 permission denied for function`, and `resend_unit_proof` refuses a non-staff caller with
`staff only`. The PNG route is staff-gated the same way the CSV exports are, because it is a
picture of somebody's card behind a guessable id.

### Acceptance script (needs a live Premium order)

Nothing below has been run: no Premium card has ever been ordered.

1. Buy a Premium card. The order lands on the `custom` path with one `pending` unit.
2. On `/dashboard/orders`, choose a profile for the card. The unit moves to
   `awaiting_approval` and the preview renders.
3. Try approving with the profile unpublished → refused, and the panel says why.
4. Publish it, approve → `proof_snapshot` is written, `approved_by` is the CUSTOMER's user id
   (not a staff id, not null), and `approved_at` is set.
5. Edit the profile's title. The customer's panel still shows the approved version, and
   `/print/proof?unit=…` and `/api/proof/…` still render the old text.
6. On `/admin/orders/<id>`, print the front and download the PNG. Confirm 1011 × 638.
7. Request changes on a second unit → the order moves to `revision_requested` and the note
   shows on the admin page. Resend → back to `awaiting_approval`.
8. Replace a card from `/dashboard/devices` → checkout shows the right SKU at KES 1,000, the
   order carries `replaces_tag_id`, and no new identity is minted
   (`select count(*) from payment_tags` unchanged).

---

## 8. Risks and what is NOT in 8c

- **No Premium card has ever been ordered**, so the whole flow is unexercised by a real
  customer. The proof renderer in particular has never had a real logo through it — Satori
  fetches the image, and a Supabase storage URL that 403s would render a card with a hole in it.
- **The proof template is fixed and plain.** One layout, no choices. That is the decision
  (D-029), but the first customer to ask for something else will be told no.
- **Premium replacements do not reuse the approved snapshot yet.** The brief says a Premium
  replacement should start at `approved` from the old card's artwork; it currently walks the
  custom path from the beginning, so the customer approves again. Not wrong, just more steps.
- **The marketing teaser and quote page** still describe cards and stands without naming
  Premium. They read as ranges rather than as claims, so nothing there is false.
- **Staff cannot override proof fields.** The brief allowed it; `resend_unit_proof` puts the
  card back in front of the customer instead, because the front is generated from the
  customer's own profile and editing somebody else's profile is not something the ops console
  should do.
