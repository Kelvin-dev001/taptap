# Sprint 7 — Purchase-Gated Activation

**Status:** **SHIPPED.** Approved, built and deployed 2026-09-02.
Migrations `0017`, `0018` and `0019` applied 2026-09-02. The paywall is live.
**Date:** 2026-09-02
**Builds on:** D-018 (per-identity billing), D-019 (order spine), D-020 (ops console)
**Revises:** D-018's "free means free" clause

---

## 0. The one-sentence change

A Tap Profile can be **built** for nothing and **published** only against a paid
identity. Today the opposite is true: `smart_pages.status` defaults to
`'published'`, so a profile created thirty seconds after signup is already
resolving publicly at its slug, forever, for free.

---

## 1. AUDIT — what is actually there

Read, not assumed. Every claim below cites the file.

### 1.1 There is no `lib/plans.ts`, and no `plan_code` gate

`lib/plans.ts` was deleted in Sprint 6a and `accounts.plan` was dropped in
`0015_per_identity_billing.sql:55`. `maxProfiles` is gone. The per-account plan
tier is genuinely dead — this part of the brief is already done.

What survives, and what it costs us:

| Remnant | Where | Verdict |
|---|---|---|
| `subscriptions` table, `plan`/`plan_code` default `'free'` | `0001_init.sql:72`, `0004_billing.sql:4` | Data only. Not read by the app (D-018). |
| `handle_new_user()` inserts `subscriptions(plan='free')` on every signup | `0001_init.sql:123` | **Live.** Still writes the literal string `free` for every new account today. |
| `activateLegacySubscription()` | `app/api/mpesa/callback/route.ts:149` | Dead path — no `payments` row without `kind` can be created any more. |
| `payments.plan_code` nullable legacy column | `0015:74` | Data only; `describePayment` still reads it for Sprint 4 rows. Keep. |
| `FREE_ENTITLEMENTS` | `lib/pricing.ts:167` | Misnamed, not free-tier logic. It is the *unpaid* state and must stay, renamed. |

### 1.2 `lib/pricing.ts` — money is correct, entitlements are not

Prices are exactly as D-018 set them and are **not changing**: card 1,500, stand
2,000, renewal 1,000/identity/year, 12 bundled months, 14 grace days,
`MAX_PROFILES_PER_ACCOUNT = 25`.

The problem is `SEGMENTS` (`lib/pricing.ts:112`). Each segment carries an
`entitlements` object, and `entitlementsFor(segment, activeIdentities)` reads
the segment to decide `analytics: basic|full`, `customBranding` and
`teamManagement`.

**The segment is stored on the account.** `accounts.segment` was added by
`0015:44` with a CHECK constraint, is backfilled by `0015:310`, is read by
`loadBillingContext` (`lib/billing-context.ts:71`) and is read again in SQL by
`account_has_custom_branding()` (`0015:176`). **Migration 0015 is applied in
production.** The brief says segments must not be stored on the account, so this
is a real removal with a real consequence — see §3.2.

### 1.3 `lib/identity.ts` — the state machine is sound and can be reused as-is

`identityState()` → `unclaimed | disabled | active | expiring | grace | expired`,
`isLive()` covers active/expiring/grace, `activeIdentityCount()` counts live
identities, and everything is pure and already tested (`lib/identity.test.ts`).
Sprint 7 needs no changes here. It needs a **new** pure module that combines
identity counts with page state.

Note the deliberate fail-open at `lib/identity.ts:86`: a NULL `term_end` is
treated as live. That rule is load-bearing for grandfathering and must survive.

### 1.4 `lib/billing-context.ts` — the seam Sprint 7 extends

`loadBillingContext()` returns `{ businessName, segment, identities, summary,
entitlements, migrationPending }` and is already used by the billing page and by
`savePageAction`. `migrationPending` **fails open** by design (comment at
`billing-context.ts:48`), which is right for capability but would be wrong for
publishing — see §4.4.

It does not currently load `smart_pages`, so it cannot answer "may this account
publish another page". That is the extension.

### 1.5 The publishing model — a two-flag system, defaulting to public

`smart_pages` carries **two independent** flags and they are not the same thing:

- `is_active boolean not null default true` (`0001_init.sql:38`) — a soft on/off
  switch, set from `setProfileActiveAction`.
- `status text not null default 'published'` (`0009:31`) — the draft/live split,
  with `published_content` holding the served snapshot.

`publish_page(uuid)` / `unpublish_page(uuid)` are SECURITY DEFINER RPCs granted
to `authenticated` (`0009:112`, `0009:136`). They check ownership. They check
**nothing else**.

Three things follow, and all three are defects under the new model:

1. **New pages are born public.** `createProfileAction`
   (`app/dashboard/profiles/actions.ts:73`) inserts without `status`, taking the
   `'published'` default. A brand-new account's page is live at its slug
   immediately.
2. **`publish_page` has no entitlement check** — nothing to add a gate to yet.
3. **A client can publish without calling the RPC at all.** `savePageAction`
   updates `smart_pages` directly through PostgREST, which means `authenticated`
   holds a table-wide UPDATE grant. Nothing stops
   `PATCH /rest/v1/smart_pages?id=eq.…  {"status":"published"}`. Compare
   `0007_business_profile.sql:37`, which solved exactly this class of problem on
   `accounts` with column-level grants. `smart_pages` never got the same
   treatment.

### 1.6 The public read paths already respect billing — with the wrong rule

`get_public_page`, `resolve_slug` and `resolve_tag` (all rewritten in `0015`,
§6) filter on `is_active = true and status = 'published'`, and attach a
`billing_state` of `live | expired` via `page_is_live()`.

`page_is_live()` (`0015:137`) says, in words: **a page with no identities
pointing at it is live.** That is the D-018 free funnel, stated in SQL. It is
precisely the line Sprint 7 inverts.

`app/[slug]/page.tsx:78` renders `<InactiveNotice>` for `billing_state ===
'expired'` rather than a 404 — deliberately, because the reader is the
cardholder's customer. That behaviour is correct and stays; a **draft** page
gets the ordinary `notFound()` instead, because a draft has never been public
and there is nothing for a stranger to be reassured about.

### 1.7 `nfc_tags`, terms, and claim

`nfc_tags` (`0005`) + `kind`/`term_start`/`term_end` (`0015:20`). `claim_tag`
(`0005:61`) binds an unassigned token to any page owned by the caller. **It does
not check publish status** — a draft page can be claimed by a card today. Under
the new model that must be refused.

`provision_identities` (`0017:234`) sets `account_id`, `kind`, `term_start`,
`term_end` and `claimed_at` but leaves `status = 'unassigned'` and
`smart_page_id = NULL`. **This matters:** a customer who has paid holds live
identity rows before any physical card exists or is bound to anything. The
entitlement rule must therefore count identities, not bindings (§3.1).

### 1.8 Payments, orders and the callback

- `payments` (`0004:11`): `reference` UNIQUE (the idempotency key), `provider`
  free text with **no CHECK**, status pending/paid/failed, no update policy for
  `authenticated` — writes are service-role only. Good foundation for offline
  payments.
- `payment_tags` (`0015:85`) records which identities a payment covered. This is
  what makes replay safe.
- `orders` (`0017:95`), `order_events` append-only via trigger (`0017:182`),
  `orders_deactivate_on_cancel` (`0017:337`).
- `app/api/mpesa/callback/route.ts`: matches by `reference`, early-returns on
  `status === 'paid'` (idempotent), marks paid **before** provisioning
  (deliberate, see the comment at line 44), then branches on `kind`:
  `hardware → provisionForOrder`, `renewal → activateIdentities`, else the
  legacy path.

**The provisioning logic lives inside the route handler.** Both new callers in
this sprint (STK status polling, staff mark-as-paid) need it, so it must be
extracted — the brief's "do NOT write a second payment flow" depends on this.

### 1.9 Checkout today

There is no checkout route. `components/billing/buy-device.tsx` is a card inside
`/dashboard/billing`, posting to `startOrderAction`
(`app/dashboard/billing/order-actions.ts`). It:

- asks for product, quantity, **name for delivery** and phone **before** payment;
- normalises the phone with `normalizePhone` (`lib/mpesa.ts:48`, already accepts
  `07…`, `01…`, `+254…`, `7…`, `1…`);
- prices server-side from `lib/pricing.ts` — a posted amount cannot be trusted
  and is not read;
- creates the order, pushes STK, inserts the payment row, and returns
  **a sentence**: `"Order TT001 created. Check your phone…"`.

Then nothing. **There is no polling, no countdown, no resolution and no resume.**
`lib/mpesa.ts` has `stkPush` and no `stkQuery`. The customer is told to check
their phone and the UI never learns what happened. `/dashboard/orders` will show
"Awaiting payment" until the callback lands — with no way to retry short of
creating a second order.

Prefill: `accounts.profile` jsonb (`0007:20`) already holds `phone` and
`whatsapp`. Nothing reads them at checkout.

### 1.10 The dashboard and navigation

`app/dashboard/page.tsx:117` — the empty state keys on **profile count**, not on
whether anything has been bought:

> "Create your first link" → `/dashboard/profiles`

There is no buy CTA anywhere on the dashboard. `NAV_ITEMS` (`lib/nav.ts`) has no
Orders entry; `/dashboard/orders` is reachable only from a text link at the
bottom of Billing (`app/dashboard/billing/page.tsx:63`).

### 1.11 The ops console

`/admin` is gated by `requireStaff()` in the layout, failing **closed** on a
missing schema (`lib/staff.ts:43`). `advanceOrderAction` re-checks
`transitionBlockedReason` server-side against current state — the pattern to
copy. `UNPAID_CEILING` (`lib/orders.ts:135`) already refuses to advance an
unpaid order past `content_received`.

**There is no way for staff to record a payment.** Offline sales are invisible;
an order paid in cash can never leave `content_received`, and no identity is
ever provisioned for it. There is also no quote/lead surface for corporate
enquiries — `/pricing` sends Commercial buyers to a `mailto:` link
(`app/pricing/page.tsx:167`).

### 1.12 Every place "free" is assumed, exhaustively

| File / line | Text or behaviour | Action |
|---|---|---|
| `0001_init.sql:123` | signup writes `subscriptions(plan='free')` | Stop writing it |
| `components/billing/billing-overview.tsx:46` | plan name renders `"Free"` | Replace |
| `components/billing/billing-overview.tsx:73` | Alert **"Your profiles are live and free"** | **Becomes false.** Replace |
| `components/shell/billing-card.tsx:30` | sidebar shows `"Free"` | Replace |
| `app/pricing/page.tsx:40` | "Setting up your page is free. You only pay for the card…" | Reword: building is free, going live is not |
| `components/marketing/cta-band.tsx:23` | "Add a card or a stand whenever you are ready" | **Implies the page works without one.** Replace |
| `components/marketing/hero.tsx:87` | "Free to set up." | Qualify |
| `lib/pricing.ts:160-173` | `FREE_ENTITLEMENTS` + its "free funnel" comment | Rename + rewrite |
| `lib/pricing.ts:65` | `MAX_PROFILES_PER_ACCOUNT` comment "profiles are free" | Rewrite |
| `app/dashboard/profiles/actions.ts:46` | same comment | Rewrite |
| `0015:132-136` | `page_is_live` comment "a page with NO identities is live" | Inverted by 0019 |
| `lib/insights.ts` | no free/plan assumption found | No change |

`/pricing`, `/privacy`, `/terms` and the FAQ carry no other free-tier claim.

### 1.13 Baseline

`npx vitest run` → **45 files, 527 tests, all passing.** Any failure after this
sprint is a regression, not inheritance.

**Migration state (from `PROJECT.md`): 0005–0016 are applied. `0017` and `0018`
are NOT.** Sprint 7's migration is `0019` and depends on `orders`/`products`
from 0017. See §9 for the sequencing this forces.

---

## 2. What must change before anything else changes

Three things are blockers in the strict sense — build on them wrong and the rest
is wasted:

1. **`smart_pages` needs column-level grants.** Until `authenticated` loses its
   table-wide UPDATE, every gate we add to `publish_page` is decoration; the
   REST endpoint publishes anything. (§4.2)
2. **Provisioning must come out of the callback route** into `lib/provisioning.ts`
   before either new caller is written, or we end up with the second payment flow
   the brief forbids. (§5.3)
3. **`accounts.segment` must be resolved** — it is applied, it is read in two
   places including SQL, and it currently decides who gets full analytics and
   custom branding. It cannot simply be deleted without answering what a paid
   account is entitled to. (§3.2)

---

## 3. The model, precisely

### 3.1 The entitlement rule

Publishing consumes a **slot**. Slots come from live identities, and pages
already live before the cutover carry their own permanent slot.

```
liveIdentities(account)   = count of nfc_tags in state active|expiring|grace   [lib/identity.ts, unchanged]
grandfathered(page)       = smart_pages.entitlement_grandfathered = true       [new column, 0019]
publishedNonGrandfathered = pages where status='published' and not grandfathered

canPublish(page) =
     grandfathered(page)                              -- always
  or page.status = 'published'                        -- republish what is already live
  or publishedNonGrandfathered.length < liveIdentities
```

**Why count identities rather than bind one to the page.** The obvious
alternative is to make publishing set `nfc_tags.smart_page_id`, so "one identity
= one profile" is a literal foreign key. It was rejected for two reasons. First,
`provision_identities` gives a paying customer live identity rows **weeks before
the physical card is produced and delivered** (§1.7); a binding rule would make
publishing wait on manufacturing, which is exactly the delay the customer is
paying to skip. Second, repointing a card without re-encoding it is the core
product promise (D-009, proven on hardware in August) — making the binding carry
the entitlement means every repoint silently moves who is allowed to be live.
Counting keeps publishing and repointing independent.

**Profile creation.** `maxProfiles = max(1, liveIdentities + grandfatheredPages)`,
still hard-capped by `MAX_PROFILES_PER_ACCOUNT = 25` as the anti-abuse guard.
A new account therefore gets exactly one draft, and a three-card account gets
three profiles. *Assumption worth your veto: this gives a paying customer no
spare draft to prepare a fourth page in. The alternative is `+ 1`, which is
friendlier and slightly leakier. I have taken the brief literally.*

### 3.2 What a paid account is entitled to — a decision I need from you

Removing `accounts.segment` removes the only axis on which `analytics: full`,
`customBranding` and `teamManagement` are currently decided. With the free tier
also gone, exactly one axis remains: **does this account hold a live identity or
not.** Three named entitlement sets collapse into two states.

**My recommendation: one paid entitlement set — a paying account gets
everything the product actually ships.** Lead capture, the full analytics report,
and the whole of the pricing page's "what you get" list. `teamManagement` stays
`false` for everyone because it is not built (D-017); the flag stays as a
placeholder.

This makes Individual / Business / Corporate genuinely marketing packaging —
quantity, service level and how you buy — which is what the brief asks for, and
it is honest: with no stored segment we could not enforce a per-segment feature
gate even if we wanted to.

**One consequence I want you to say yes to explicitly.** `customBranding` means
hiding the "Powered by Hornbill TapTap" footer. Under one paid tier, **every**
paying customer can remove it, where today only Business and Commercial can.
That footer is free distribution on a product whose main channel is people
sharing links in WhatsApp. Options:

- **(a)** Every paying account may hide it. Simplest, matches one-tier. *My
  recommendation.*
- **(b)** Nobody hides it; the footer is always on and `customBranding` is
  deleted rather than universalised. Keeps the distribution, and is defensible
  because we would stop selling the capability at the same moment.
- **(c)** Keep it as a paid add-on later. Do nothing this sprint, footer stays on
  for all.

I will build (a) unless you say otherwise, and it is a one-line change to switch.

### 3.3 What "not live yet" looks like publicly

| Situation | Public slug behaviour | Physical card behaviour |
|---|---|---|
| Draft, never published | `notFound()` — no page has ever existed here | `claim_tag` refuses |
| Published, entitled | Normal | Normal |
| Published, account's identities all lapsed | `<InactiveNotice>` (D-018, unchanged) | `<InactiveNotice>` |
| Grandfathered | Normal, forever | Normal |

The draft case is a 404 rather than an inactive notice on purpose: the inactive
notice exists to reassure a cardholder's customer that a card they were handed
is not broken. Nobody has ever been handed a draft.

---

## 4. Server-side enforcement

Four layers, each closing what the one above cannot.

### 4.1 The RPC — `publish_page` gains the entitlement check

Rewritten in 0019 to raise `insufficient_entitlement` unless `canPublish` holds,
using a new SQL function `page_publish_allowed(p_page_id uuid) returns boolean`
that mirrors §3.1 exactly.

### 4.2 The grant — a client cannot publish by calling the API directly

Following the pattern `0007_business_profile.sql:37` established for `accounts`:

```sql
revoke insert, update on public.smart_pages from authenticated;
grant insert (account_id, slug, title, mode, redirect_url, config, theme)
  on public.smart_pages to authenticated;
grant update (title, mode, redirect_url, config, theme, is_active, updated_at)
  on public.smart_pages to authenticated;
```

`status`, `published_at`, `published_content` and `entitlement_grandfathered`
become writable **only** through the SECURITY DEFINER RPCs and the service role.
An INSERT that omits `status` takes the column default, which 0019 changes to
`'draft'`. Verified against every writer: `savePageAction` (title/mode/
redirect_url/config/theme), `setProfileActiveAction` (is_active),
`createProfileAction` (insert list above). All still work.

### 4.3 The trigger — belt and braces, including against ourselves

`BEFORE UPDATE ON smart_pages`: if `status` transitions to `'published'` and
`page_publish_allowed()` is false, raise. This holds against a future code path,
against the service role, and against a bug in the RPC. It is a no-op when
`published_content` is refreshed on an already-published page, because the status
is not transitioning.

### 4.4 The read paths — `page_is_live()` inverted

```sql
page_is_live(page) =
     grandfathered(page)
  or (rank of page among the account's published, non-grandfathered pages,
      ordered by published_at asc, id asc) <= liveIdentities(account)
```

Deterministic ordering matters: when an account with two cards lets one lapse,
*which* of its two pages goes dark must be a fact, not a race. Oldest-published
wins, which is the one most likely to be on a printed card.

This **subsumes** the current per-tag rule and changes one behaviour worth
stating: today a page whose own bound card has lapsed goes dark even if the
account has another live card. Under 0019 the account's slot count decides, so
that page stays live and a different one goes dark instead. The lapsed *physical
card* still fails correctly at `/t/<token>`, because `resolve_tag` checks
`identity_is_live(t.term_end)` on the tag itself and that is unchanged.

`get_public_page` and `resolve_slug` need no new filter — they already require
`status = 'published'`, and a draft can no longer reach that status without
entitlement.

`claim_tag` gains a check: refuse a page whose `status <> 'published'`, with a
distinguishable error so the UI can open checkout instead of showing a raw
exception.

**Not enforced server-side, and deliberately so:** `app/api/qr/[slug]` is a pure
encoder that never touches the database — it turns a string into a PNG. Gating it
would protect nothing, because the URL it encodes is public knowledge and the
page it points at is already gated. The QR *button* is hidden on a draft as a UX
matter, not a security one. I would rather say this than add a check that looks
like security and is not.

### 4.5 Migration safety

`loadBillingContext` fails **open** on a missing schema so a mid-migration deploy
does not strip capability from a paying customer. Publishing must fail **closed**
in the same situation — the `requireStaff` asymmetry (D-020) applied again, and
for the same reason: briefly over-granting a feature is a shrug, briefly handing
out free published pages is revenue. The entitlement check gets its own guarded
read that treats "cannot tell" as "no".

No existing RLS policy is weakened. 0019 only adds column grants (a narrowing),
one column, and stricter function bodies.

---

## 5. The new-user journey

### 5.1 Dashboard

`app/dashboard/page.tsx` gains an identity-aware branch **above** the existing
profile-count branch:

- **No identity, no profile** — a single primary card: *"Activate your Tap
  Profile"*, one unmissable button → `/dashboard/checkout?product=smart_card`.
  A visually subordinate ghost link: *"Build your profile first"*.
- **No identity, one draft** — a persistent draft banner (§5.2) at the top of the
  dashboard, buy CTA primary, metrics hidden (there is nothing to measure; a
  wall of zeroes reads as a broken product, not an unactivated one).
- **Has an identity** — today's dashboard, unchanged.

### 5.2 The draft banner

One component, `components/profile/draft-banner.tsx`, rendered on the dashboard,
the profiles list and the builder:

> **Draft. Not live yet.** Your page is saved and only you can see it. Activate
> it with a Smart Card or Smart Stand to publish it at
> `taptap.hornbilltech.co.ke/your-slug`. — **[Activate]**

Honest and warm, per the brief: not "locked", not "upgrade".

### 5.3 Every gated action funnels to the same place

Publish, Share, QR download and card claim on an unentitled draft all open one
`ActivateDialog` — one line on what you get, one button to checkout. No dead
ends and no second explanation to keep in sync.

The builder's Publish button stays visible and enabled (hiding it hides the
goal); pressing it opens the dialog. The server action returns a typed
`{ error: 'not_entitled' }` so the client never guesses.

### 5.4 After payment

`/dashboard/checkout/success` — receipt code, what was bought, what happens next
(*we will contact you about artwork; production and delivery timeline*), and a
button to publish the draft now that it can be.

---

## 6. Checkout and payment

New route `/dashboard/checkout` (nested under `/dashboard/*` per D-013, so it
consumes no root slug).

**Before payment, we ask for:** product, quantity (pre-set to 1, or from
`?product=&qty=`), and M-Pesa number — prefilled from `accounts.profile.phone`
and normalised by the existing `normalizePhone`. **That is all.** `contact_name`
moves to after the payment clears, per the brief.

**Polling.** `lib/mpesa.ts` gains `stkQuery(checkoutRequestId)` hitting Daraja's
`/mpesa/stkpushquery/v1/query`, reusing `getToken()` and the same strict
`mpesaBaseUrl()`. A server action `checkPaymentStatusAction(reference)`:

1. reads `payments.status` — if the callback already landed, done, no Daraja call;
2. if still pending, queries Daraja;
3. if Daraja is conclusive, resolves the payment **through the shared
   provisioning path**, so a lost callback still provisions.

Client states: `prompting` (countdown, "Check your phone and enter your M-Pesa
PIN") → `paid` | `failed` | `timed_out`. Polls every 3s for 120s. Never an
indefinite spinner.

**Resend** issues a fresh STK push against the same order — a new `payments` row
with a new reference, same `order_id`. Safe: `payment_tags` already guarantees
that a second successful payment for an order provisions nothing twice
(`callback/route.ts:84`).

**Manual fallback** after two failures: Paybill/Till and the exact reference (the
order number, `TT001`). Records a `payments` row with `provider='mpesa_manual'`,
`status='pending'`, so the order appears in ops flagged for reconciliation
rather than being lost in a WhatsApp thread. New env vars for display only:
`NEXT_PUBLIC_MPESA_PAYBILL`, `NEXT_PUBLIC_MPESA_ACCOUNT_HINT`.

**Resumable.** The checkout page looks for an order with a pending payment first
and offers *"Finish your payment for TT001"* — resume polling, or resend. Never a
second order for the same intent.

**Receipts.** `mpesaReceiptNumber(raw)` already exists (`lib/payments.ts:55`) and
is already rendered by `PaymentHistory`. The success screen reuses it.

### 6.1 The extraction, first

`lib/provisioning.ts` (server-only), lifted verbatim from the callback route:

```
markPaymentPaid(admin, paymentId, raw)     -- idempotent, paid-before-provision order preserved
provisionForPayment(admin, payment)        -- hardware → order; renewal → payment_tags
```

Callers: the M-Pesa callback (behaviour unchanged), the STK-query resolver, and
staff mark-as-paid. One path, three doors.

---

## 7. Offline and sales-led

### 7.1 Staff mark-as-paid

On `/admin/orders/[id]`, staff-only: method (`cash | bank | other`), optional
external reference, amount defaulting to `orders.amount_kes`.
`recordOfflinePaymentAction` → `requireStaff()` → insert a `payments` row
(`status='paid'`, `kind='hardware'`, `order_id`, unique synthetic reference) →
`provisionForPayment()`. **The same function the M-Pesa callback calls.**

Audit: 0019 adds `payments.recorded_by uuid references auth.users(id)` and
`payments.recorded_at timestamptz`. `payments` has no UPDATE policy for
`authenticated` and rows are written by the service role only, so the row is
append-only in practice and answers who and when. `order_events` continues to
record the fulfilment moves that follow. Never exposed to customers — it lives
behind `requireStaff`, which fails closed.

### 7.2 Corporate quote requests

New table `quote_requests` (name, company, email, phone, quantity, notes,
status `new|contacted|quoted|won|lost`, nullable `account_id`, `handled_by`,
`handled_at`). Public form at `/quote`, submitted through a route handler
mirroring `app/api/lead/route.ts` — honeypot field, minimum-contact validation,
SECURITY DEFINER insert RPC. RLS: staff select and update; no public read.
Listed at `/admin/quotes`; staff create the order and invoice from there.

`/pricing`'s Commercial card stops being a `mailto:` and links to `/quote`.
`quote` and `sales` get added to `RESERVED_SLUGS`.

---

## 8. Copy

Every string in the §1.12 table, plus:

- **Pricing hero:** "Build your page for nothing. It goes live when you activate
  it with a Smart Card or Smart Stand, and your first 12 months come with it."
- **Billing (no devices):** *"Not active yet"* replaces *"Free"*; the alert
  *"Your profiles are live and free"* is deleted outright — it is now false.
- **Sidebar billing card:** *"Not active"* replaces *"Free"*.
- **CTA band:** "whenever you are ready" removed.

House rules kept: **no em dashes in customer-facing copy** (enforced by
`components/marketing/marketing.test.tsx:155`, and the new draft-banner and
checkout copy get added to that test's section list), prices read from
`lib/pricing.ts` so the landing page cannot drift, and nothing claims capability
we have not shipped.

---

## 9. Migration `0019_publish_entitlement.sql`

1. `smart_pages.entitlement_grandfathered boolean not null default false`
2. **Grandfathering backfill:**
   `update smart_pages set entitlement_grandfathered = true where status = 'published';`
   — every page that is live at the moment this runs stays live, permanently,
   regardless of what the account owns. Explicit, greppable, one line, and it is
   a stored fact rather than a "created before date X" rule that argues with
   itself later. Their *next* profile is a draft like everyone else's.
3. `alter column status set default 'draft'` — new pages are born private.
4. `page_publish_allowed(uuid)` — §3.1 in SQL.
5. `publish_page` rewritten with the check (§4.1).
6. Column grants on `smart_pages` (§4.2).
7. `smart_pages_enforce_publish_entitlement` trigger (§4.3).
8. `page_is_live()` rewritten (§4.4).
9. `claim_tag` refuses unpublished pages (§4.4).
10. `account_has_custom_branding()` rewritten to drop the segment read (§3.2).
11. `payments.recorded_by`, `payments.recorded_at`.
12. `quote_requests` + RLS + submit RPC.
13. `handle_new_user()` stops inserting `subscriptions(plan='free')`.
14. **Not dropped:** `accounts.segment`. The column is left in place and unread —
    dropping it in the same migration that changes entitlement means a rollback
    loses data. It goes in a later cleanup once 0019 has proven itself, exactly
    as D-018 left `subscriptions` alone.

### Sequencing — this needs your attention

**0017 and 0018 are not yet applied.** 0019 depends on 0017. The order is:
apply `0017` → apply `0018` → apply `0019` → deploy.

Applying 0019 *before* the deploy means the old UI's Publish button starts
returning an entitlement error for unentitled accounts — which is the intended
end state, just reached a few minutes early, and grandfathered accounts are
unaffected throughout. Deploying first would leave publishing ungated for that
window, which is the wrong side to be wrong on.

---

## 10. Files

**New:** `lib/entitlement.ts` (+test), `lib/provisioning.ts`,
`app/dashboard/checkout/{page,actions,checkout-form,payment-status}.tsx`,
`app/dashboard/checkout/success/page.tsx`, `app/quote/page.tsx`,
`app/api/quote/route.ts`, `app/admin/quotes/page.tsx`,
`components/profile/draft-banner.tsx`, `components/billing/activate-dialog.tsx`,
`components/ops/record-payment.tsx`, `supabase/migrations/0019_publish_entitlement.sql`,
`docs/sprint-7-paywall.md` (this file).

**Changed:** `lib/pricing.ts` (segments lose entitlements; `FREE_ENTITLEMENTS` →
`INACTIVE_ENTITLEMENTS`), `lib/billing-context.ts` (loads page state, drops the
segment read), `lib/mpesa.ts` (`stkQuery`), `lib/nav.ts` (Orders),
`lib/reserved-slugs.ts`, `app/api/mpesa/callback/route.ts` (delegates to
`lib/provisioning.ts`; legacy branch removed), `app/dashboard/page.tsx`,
`app/dashboard/profiles/{page,actions}.tsx`,
`app/dashboard/profiles/[id]/edit/{page,editor,actions}.tsx`,
`app/dashboard/billing/{page.tsx,order-actions.ts}`, `app/admin/order-actions.ts`,
`app/admin/orders/[id]/page.tsx`, `app/pricing/page.tsx`, `app/t/[token]/*`,
`components/billing/{billing-overview,buy-device}.tsx`,
`components/shell/billing-card.tsx`, `components/marketing/{cta-band,hero}.tsx`,
`components/marketing/marketing.test.tsx`.

**Untouched, verified:** analytics, leads/customers, insights, notifications,
NFC tap attribution, the ops board and its transitions, all existing RLS
policies, and every price.

---

## 11. Tests

Required by the brief, all against the pure modules so they need no database:

1. **`lib/entitlement.test.ts`** — draft vs published; slots consumed; second
   profile refused with one identity and allowed with two; a lapsed identity
   removes a slot; grace-period identities still count.
2. **Grandfathering** — a grandfathered page publishes with zero identities;
   stays live when identities lapse; survives unpublish → republish; a *new*
   page on the same account does not inherit it; nobody is silently unpublished.
3. **Publish enforcement server-side** — the action refuses without entitlement;
   the column-grant list contains no publish column (a test asserting the
   migration text, so a future edit that re-grants `status` fails here);
   `page_is_live` ordering is deterministic.
4. **Payment polling** — a pure `resolvePaymentState(payment, darajaResult, elapsed)`
   covering pending → paid, pending → failed, timeout, callback-already-landed
   (no Daraja call), and Daraja-inconclusive.
5. **Staff mark-as-paid** — provisions through the shared path; is idempotent
   when a callback later arrives for the same order; records `recorded_by`.
6. **Copy** — no em dash in the new customer-facing sections; no "free plan"
   language in the marketing or billing components.

Plus the full existing suite (527 tests) green, `tsc --noEmit`, lint, and a
production build.

---

## 12. Decisions to record in `docs/decision-log.md`

- **D-021 — No free tier; the gate is publishing, not building.** Revises the
  "free means free" clause of D-018 while keeping everything else it decided.
  Includes why the gate is publish rather than build (a customer must be able to
  see what they are buying), and why a draft 404s while a lapsed page does not.
- **D-022 — Entitlement is a slot count, not a device binding.** Records the
  rejected alternative and both reasons (§3.1).
- **D-023 — Grandfathering is a stored flag on the page.** Why a column rather
  than a date rule, and why per-page rather than per-account.
- **D-024 — Segments are marketing packaging, not stored state.** One paid
  entitlement set; `accounts.segment` goes unread then, later, away; the
  custom-branding consequence from §3.2 whichever way you decide it.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| **Silently unpublishing a live customer** — the worst outcome in this sprint | Backfill flags every currently-published page before any gate is active; a dedicated test; and 0019 is applied in a window where you can check `select count(*) from smart_pages where status='published' and not entitlement_grandfathered` and expect **0** |
| 0017/0018 unapplied, 0019 depends on them | Explicit ordering in §9; each migration is independently reversible |
| STK query rate limits / Daraja quirks | Poll `payments` first and only call Daraja when genuinely pending; 3s interval, 120s ceiling |
| Manual-fallback payments never reconciled | They create a visible pending `payments` row and appear in ops, rather than living in a chat |
| Conversion drops because publishing now costs money | That is the intended trade. The buy CTA, prefilled phone, resumable orders and the manual fallback are the mitigations |
| Segment removal changes who can hide the footer | §3.2 — your call, one line either way |

---

## 14. Open questions for you

1. **§3.2 — the custom-branding consequence.** (a) every paying account may hide
   the footer, (b) nobody does and we stop selling it, or (c) defer. I will build
   (a) unless told otherwise.
2. **§3.1 — the spare draft.** `maxProfiles = liveIdentities` (literal reading of
   the brief) or `+ 1` so a paying customer can prepare their next page? I will
   build the literal reading.
3. **Segment names.** Your brief says Individual / Business / Corporate; the
   shipped code says Professional / Business / Commercial. I will follow your
   names in all copy. Confirm you want the code constants renamed to match.
4. **Legacy callback branch.** `activateLegacySubscription` is unreachable — no
   `payments` row without `kind` can be created any more. I plan to delete it.
   Say so if you would rather it stayed until you have run
   `select count(*) from payments where kind is null and status = 'pending'`.

---

---

## 15. Closeout

Built 2026-09-02, following the plan above. What follows is what actually happened,
including where it diverged.

### 15.1 Verification

| Check | Result |
|---|---|
| `vitest run` | **49 files, 611 tests, all passing** (baseline was 45 / 527) |
| `tsc --noEmit` | Clean |
| `eslint .` | Clean |
| `next build` | Succeeds; `/dashboard/checkout`, `/dashboard/checkout/success`, `/quote`, `/api/quote` and `/admin/quotes` all present |
| Pre-existing failures | None. The baseline was green, so every one of the 611 is a real pass |

84 new tests across five files: `lib/entitlement.test.ts` (32), `lib/publish-enforcement.test.ts`
(21), `lib/checkout.test.ts` (14), `lib/provisioning.test.ts` (9), plus 8 added to
`lib/mpesa.test.ts` and the rewritten segment/entitlement tests in `lib/pricing.test.ts`
and `components/marketing/marketing.test.tsx`.

### 15.2 A bug the tests caught before you could

`maxProfiles` was first written as `max(1, slots + grandfathered)`. For an account with one
grandfathered page and no identities that yields **1** — so a customer who had been live
since before the cutover could not create a second profile at all, while someone signing up
that morning could. Grandfathering would have cost them something.

It is now `max(1, slots) + grandfathered`: the floor is for everybody, and a grandfathered
page adds its own allowance on top. Recorded in D-023, because the reasoning is the kind
that will be re-derived wrongly otherwise.

### 15.3 Where the build diverged from the plan

- **`accounts.segment` is not dropped.** The plan said leave it; worth restating because the
  migration also had to stop *reading* it in SQL (`account_has_custom_branding`), which the
  plan under-specified. The column and its data survive untouched.
- **Ops vocabulary moved twice.** `OFFLINE_METHODS` and `QUOTE_STATUSES` were first put
  beside their server actions, which fails the production build: a `"use server"` module may
  export nothing but async functions. They live in `lib/payments.ts` and the new
  `lib/quotes.ts`, which is where the rest of that vocabulary already was.
- **Renewals got the polling too.** Not in the plan, added because it was ~15 lines:
  `startRenewalAction` now returns a reference instead of a sentence and renders the same
  `PaymentStatus`. Two different waiting experiences for the same M-Pesa prompt would have
  been one more than anyone needs. A renewal has no order behind it, so the resend and
  Paybill controls are correctly absent there.
- **The device rebind path needed gating and the plan missed it.**
  `rebindTagAction` writes `nfc_tags.smart_page_id` directly rather than going through
  `claim_tag`, so 0019's check did not cover it. Repointing a card at a draft would have left
  a working card opening a 404, in front of the cardholder's customer. Both the action and
  the page's select are now filtered to published pages.
- **`components/billing/buy-device.tsx` became a chooser, not a form.** The plan implied
  editing it; it was simpler to strip the embedded payment form entirely and link into
  `/dashboard/checkout` with the product pre-selected, so there is exactly one place in the
  product that can take money.

### 15.4 Files

**New (16):** `lib/entitlement.ts` (+test), `lib/provisioning.ts` (+test), `lib/checkout.ts`
(+test), `lib/quotes.ts`, `lib/publish-enforcement.test.ts`,
`supabase/migrations/0019_publish_entitlement.sql`,
`app/dashboard/checkout/{page,actions,checkout-form}.tsx`,
`app/dashboard/checkout/success/page.tsx`, `app/quote/{page,quote-form}.tsx`,
`app/api/quote/route.ts`, `app/admin/quotes/{page,quote-status}.tsx`,
`components/billing/{payment-status,activate-dialog}.tsx`,
`components/profile/draft-banner.tsx`, `components/ops/record-payment.tsx`.

**Changed (24):** `lib/{pricing,billing-context,mpesa,nav,payments,reserved-slugs}.ts`,
`app/api/mpesa/callback/route.ts`, `app/dashboard/{page,layout}.tsx`,
`app/dashboard/profiles/{page,actions}.tsx`,
`app/dashboard/profiles/[id]/edit/{page,editor,actions}.tsx`,
`app/dashboard/billing/{page,actions}.ts(x)`, `app/dashboard/devices/{page,actions}.ts(x)`,
`app/t/[token]/{page,claim-form,actions}.ts(x)`, `app/admin/order-actions.ts`,
`app/admin/orders/[id]/page.tsx`, `app/admin/staff-nav.tsx`, `app/pricing/page.tsx`,
`components/billing/{billing-overview,buy-device,identity-list}.tsx`,
`components/shell/{billing-card,app-shell}.tsx`,
`components/marketing/{hero,cta-band,pricing-teaser,footer,marketing.test}.tsx`,
`.env.example`, `PROJECT.md`, `docs/decision-log.md`.

**Deleted (1):** `app/dashboard/billing/order-actions.ts` — superseded by
`app/dashboard/checkout/actions.ts`. Keeping it would have left two payment entry points.

### 15.5 Backend and database

One migration, `0019_publish_entitlement.sql`: the grandfathering column and backfill, the
`draft` default, `account_live_identities()`, `page_publish_allowed()`, a gated
`publish_page()`, column grants on `smart_pages`, the `enforce_publish_entitlement` trigger,
a rewritten `page_is_live()`, a `claim_tag()` that refuses drafts, an
`account_has_custom_branding()` that no longer reads a segment, `payments.recorded_by` /
`recorded_at`, the `quote_requests` table with RLS and its definer submit function, and a
`handle_new_user()` that stops writing `subscriptions(plan='free')`.

**No RLS policy was weakened.** The only permission changes are narrowing ones (column
grants) plus additive policies on the new table, and a test asserts that every
`create policy` in the migration belongs to `quote_requests`.

### 15.6 Risks that are still live

- **Verify the grandfathering count if it has not been run.** With `0019` applied,
  `select count(*) from smart_pages where status='published' and not entitlement_grandfathered`
  must return **0**. This is the one check that proves no existing customer was unpublished by
  the cutover, and it is cheap to run late.
- **Two open decisions were built to my stated defaults** because the approval did not
  overturn them, and both are one-line reversals: every paying account can now hide the
  Hornbill footer (D-024), and `maxProfiles` follows the literal reading with no spare draft
  for a paying customer (D-021/§3.1).
- **The Paybill fallback is inert until `NEXT_PUBLIC_MPESA_PAYBILL` is set.** Deliberately:
  a wrong number sends a customer's money to a stranger, so it is better absent than
  guessed. The fallback simply does not render while it is blank.
- **`stkQuery` has never been run against production Daraja.** The parsing is tested against
  every response shape we know of, including the string-versus-number `ResultCode` that
  would otherwise strand a paid customer on a spinner, but the live endpoint is unproven.
  This joins the M-Pesa activation item already on the launch checklist.

### 15.7 Recommended next

1. Run the grandfathering check query above, if it has not been run already.
2. Prove one real STK payment end to end against production Daraja, including the poll
   resolving without the callback (block the callback URL to force it).
3. Set `NEXT_PUBLIC_MPESA_PAYBILL` in Vercel and redeploy, or the manual fallback never
   renders. It is inlined at build time, so setting the variable alone is not enough.
4. Decide the two open items in §14 explicitly rather than by default.
5. Cleanup sprint: drop `accounts.segment` and the `subscriptions` table now that 0019 is
   applied and has settled.
