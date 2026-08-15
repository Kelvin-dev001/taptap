# Sprint UI-9 — Billing

**Date:** 2026-08-15 · **Status:** Complete · **Follows:** `docs/sprint-ui-8-leads.md`

Closes **audit item B13**, the last significant item from the UI-0 audit, and turns the
billing screen into something that answers a customer's actual questions.

**No migration this sprint.** Everything needed was already in the schema — the bug was
entirely in application code, and the payment history was sitting in a table nobody read.

---

## B13 — a lapsed subscription kept everything

`planFor(sub?.plan_code)` reported **what was bought**, never **what is still owned**. Nothing
anywhere checked `current_period_end`. So an annual subscription that ended eleven months ago
still granted five profiles, lead capture and advanced analytics, and the billing screen
cheerfully displayed "Pro" to someone who had stopped paying.

This is a correctness bug with revenue attached, and it had been open since the audit.

### The fix

`lib/plans.ts` now distinguishes two questions that were being conflated:

| Function | Answers |
|---|---|
| `purchasedPlan(sub)` | what the customer bought — for the billing screen |
| `effectivePlan(sub)` | what still applies today — for **every** entitlement check |

`subscriptionState()` classifies a subscription as `free` / `active` / `expiring` / `expired`
/ `inactive`, and every call site that gated a feature was moved onto `effectivePlan`:

- profile limits when creating a link
- lead capture when saving a profile
- the lead-capture toggle in the editor
- the plan shown in the sidebar

Two deliberate choices inside that logic:

- **A paid plan with no end date stays active.** The safe failure is to keep serving a paying
  customer, not to cut them off because a timestamp is missing.
- **A provider problem outranks the dates.** A `status` other than `active` means free,
  whatever `current_period_end` says.

### Lapsing never destroys work

An expired Pro account with five profiles keeps all five. It simply cannot create a sixth.
Entitlements lapsing must not delete what an owner built — tested explicitly.

### One hole left open on purpose

A page that was **already published** with a lead form keeps collecting leads after the plan
lapses, until the owner republishes. Closing that would mean either a plan lookup on the
latency-critical tap path, or rejecting a visitor's submission at `submit_lead`.

Rejecting submissions was the wrong trade: a customer fills in a form, sees an error, and the
business loses an enquiry it may well have paid for. Blocking *new* privileges while honouring
*existing* published pages is the standard SaaS posture and the kinder failure. Enforcement
therefore happens on the write paths the **owner** controls, never on the visitor's.

---

## The billing screen

Per §21 it covers plan, renewal, payment status, history and receipts — and deliberately
**not** usage, branches or team members.

### Two facts customers otherwise have to guess

Both are consequences of D-006 (annual-first, M-Pesa Ratiba deferred), and stating them turns
missing features into understood behaviour:

- **Nothing renews automatically.** There is no standing M-Pesa mandate, so a plan simply ends
  on its date. **There is nothing to cancel** — which is why there is no Cancel button. A
  button that did nothing would be theatre.
- **No card is stored.** Every payment is a one-off STK prompt to a number entered at the time.

### Payment history and receipts

The `payments` table has existed since migration `0004` and was never surfaced. It now backs a
real history, including **pending rows** — a payment that never completed is precisely what an
owner is looking for when they think they have paid, and hiding it turns a self-service check
into a support message. Each status says what it means: *"Waiting for the M-Pesa PIN prompt to
be completed."*

`/print/receipt` renders a printable receipt from real payment data, with the M-Pesa receipt
number extracted from the stored Daraja callback. `lib/payments.ts` returns **only** the two
fields a receipt needs — the stored callback also carries the payer's phone number, and
nothing in that module hands back the raw object, so a receipt view cannot leak the rest of
the payload. A test asserts that.

It is labelled a **payment receipt, not a tax invoice**: TapTap is not registered to issue one,
and mislabelling it would be worse than useless to a business filing returns.

---

## Tests

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **237 passed** (213 + 24 new), 27 files |
| `npm run build` | compiled successfully |
| Route smoke | receipt requires auth, 404s without an id; 0 runtime errors |

New coverage: expiry boundaries either side of the period end, the warning window edges,
provider problems outranking dates, a missing end date failing safe, lapsing not destroying
existing profiles, plan-catalogue monotonicity (a dearer plan can never grant less), Daraja
callback parsing including malformed input, and that receipt extraction never returns the
payload.

## ⚠ Prices are still DRAFT — I cannot set them

`lib/plans.ts` has carried a "DRAFT — confirm before launch" marker on every price since
Sprint 4. They are now also exported as `PRICES_ARE_DRAFT` so a pre-launch check can assert
on it.

**These are a business decision, not an engineering one, and M-Pesa STK push charges real
money against them.** Launching with placeholder numbers would take incorrect payments from
real customers. The current drafts are Starter 5,000 / Pro 15,000 / Business 40,000 KES per
year.

## Technical debt

- Expiry is evaluated at read time rather than by a scheduled job. Correct and always
  accurate, but nothing writes an `expired` status, so a report of "how many lapsed accounts"
  would need to compute it in SQL rather than filter on a column.
- Already-published lead forms outlive a lapsed plan, by design (above).
- No upgrade proration or mid-term plan change: annual one-off payments make that meaningless
  today, but it becomes real if D-006's deferred M-Pesa Ratiba recurring billing lands.
- Carried forward: no error/loading boundaries, `force-dynamic` everywhere, no `public/` or
  favicon, `middleware`→`proxy` rename pending, the builder still unexercised by hand, and
  **physical NFC verification outstanding from UI-6**.

> Migration `0012_lead_workflow.sql` from UI-8 is still required for the lead screens.

## Next sprint proposal — UI-10: AI

UI-0 hard-blocked this on trustworthy data, and UI-7 delivered it: source attribution,
per-device taps, a real click-vs-confirmed split, and time-of-day patterns.

The honest scope is **deterministic, explainable insight** — not a language model. Everything
useful here is computable and provable: an action that outperforms the ones above it (from
`sort_order` and click counts), a card that underperforms its siblings (from `tag_id`), a
profile with traffic but no confirmed actions, a busiest window. Each can state its evidence
and link to the screen that proves it.

Calling that "AI" is what §30.8 exists to prevent, so it should ship as **Insights** with the
reasoning visible. Whether to add a model afterwards — for phrasing, or genuine anomaly
detection — is then a real decision made against a working baseline, rather than a label
applied to rules.
