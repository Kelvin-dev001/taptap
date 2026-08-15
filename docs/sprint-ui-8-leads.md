# Sprint UI-8 — Leads / Customers

**Date:** 2026-08-15 · **Status:** Complete · **Follows:** `docs/sprint-ui-7-analytics.md`

The lead inbox could be read and exported but not **worked**: no way to record that someone
was called back, and no way to tell a new enquiry from one settled last week. For an SME the
entire value of capturing a lead is the follow-up, so a read-only list is where leads go to
be forgotten.

---

## The decision this sprint forced — D-015

UI-7 closed by flagging a question that decides whether TapTap drifts toward being a CRM:
does "Customers" mean **people** (deduplicated, with their own lifecycle) or **submissions**?

**A lead stays a submission.** `leads` gains `status`, `note` and `updated_at`; no `contacts`
table. Repeat enquiries are surfaced by counting other submissions sharing a phone or email
at query time, so an owner still sees *"3 previous enquiries"* without a second entity
existing.

Duplicate submissions are rare at SME scale, every field needed to promote submissions into
contacts is already captured, and grouping at query time wastes no migration if the answer
turns out differently. Building the contact lifecycle now would commit the product to a CRM
shape before one customer has asked for it. Full reasoning and the reversal path are in
`docs/decision-log.md`.

---

## What shipped

### Migration `0012`

`status` (new / contacted / won / lost), `note`, `updated_at`, plus `get_leads` and
`get_lead_counts` — the latter returning per-status counts so the filter chips show real
numbers rather than filtering blind.

**`leads` had no UPDATE policy at all**, so setting a status was impossible. Adding one
raised the question `accounts` already forced in `0007`: a policy governs *which rows* may be
written, never *which columns*.

That matters more here. Name, phone, email, company and message are **a record of what a
customer submitted**. If an owner can edit them, the lead stops being evidence of what
someone actually asked for — and under Kenya's Data Protection Act the business is the data
controller for precisely that record. So:

```sql
revoke update on public.leads from authenticated;
grant  update (status, note, updated_at) on public.leads to authenticated;
```

Status and notes are the owner's annotations and are rightly editable. The submission is not.
The UI says so under the details: *"These are the customer's own words and cannot be edited."*

### The inbox

Status filter chips with counts, free-text search across name, phone, email, company, message
and profile, and a 30-day / 3-month / 1-year window — wider than analytics, because leads age
more slowly than traffic.

Status lives in the URL so a filtered view is shareable; search stays local because the list
is already loaded and capped, and a round trip per keystroke would be slower without being
more correct.

### The detail drawer

Reach out, record what happened, move it along:

- **Contact actions that work.** `whatsappNumber()` converts local Kenyan `07…`/`01…` numbers
  to international form — passing those to `wa.me` unchanged produces a dead link, which
  defeats the point of the button. Plausible foreign numbers pass through rather than being
  mangled.
- **Read-only submission**, for the reason above.
- **Status buttons** with `aria-pressed`, each explaining what it means.
- **Private notes**, using the `SaveState` primitive from UI-1.
- **Delete**, behind `ConfirmDialog`. `leads_delete_own` has existed since migration `0003`
  and was never surfaced — and honouring a request to erase someone's details is a legal
  obligation under the DPA, not a convenience.

### Shared with the per-profile view

`/dashboard/profiles/[id]/leads` now renders the same `LeadInbox` instead of its own
read-only table, so the two cannot drift the way the analytics views did before UI-7.

### Export

`/api/leads/csv` honours the active filters, so what downloads matches what is on screen.
It includes status, note and the repeat count. `no-store, private` — this file contains
customer names, phone numbers and email addresses.

---

## Tests

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **213 passed** (193 + 20 new), 26 files |
| `npm run build` | compiled successfully |
| Route smoke | `?status=bogus` handled; both CSV routes 401 signed-out; 0 runtime errors |
| Live probe | migration `0011` confirmed applied and returning the exact shape the types expect |

New coverage: status parsing rejecting junk and injection attempts, display-name fallback
never rendering an empty heading, Kenyan number normalisation for WhatsApp, contact channels
for sparse submissions, and search across every field.

## Defects fixed

A third `setState`-in-effect error, caught by lint — the drawer copied the lead's note into
state whenever the selected lead changed, which renders one frame showing the *previous*
lead's note. Replaced with the `key` remount idiom, which is the correct React answer to
"reset state when a prop changes".

## Technical debt

- Status is per-submission, so a person who enquires twice has two statuses. Correct for a
  follow-up workflow, wrong for a relationship view — the reversal path is in D-015.
- `get_leads` caps at 200 rows for the screen and 5000 for export, with no pagination. Fine
  at current volumes; a busy account will eventually need cursor paging.
- The repeat-count subquery runs per row. Cheap at this size, but it is O(n²) over the
  account's leads and should become a join or a materialised count if lead volume grows.
- Carried forward: no error/loading boundaries, `force-dynamic` everywhere, no `public/` or
  favicon, subscription expiry unenforced (**B13**), `middleware`→`proxy` rename pending, the
  builder still unexercised by hand, and **physical NFC verification outstanding from UI-6**.

> ⚠ **Migration `0012_lead_workflow.sql` is new and not yet applied.** Both lead screens show
> a migration notice until it is run.

## Next sprint proposal — UI-9: Billing

Per §21 the billing surface stays focused on plan, renewal, payment status, history and
receipts — explicitly **not** usage, branches or team members. The substantive work is
**audit item B13**, open since UI-0: `planFor()` ignores `current_period_end`, so a lapsed
annual subscription keeps full features indefinitely and the billing screen reports a plan
the customer is no longer paying for. That is a correctness bug with revenue attached, and it
is the last significant item from the original audit still outstanding. Also worth settling
there: the DRAFT prices in `lib/plans.ts`, which have carried a "confirm before launch"
warning since Sprint 4.
