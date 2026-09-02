# Sprint 7 — Purchase-Gated Activation (brief + Claude Code prompt)

Decisions locked with Kelvin (2026-08-31):

| Question | Decision |
|---|---|
| Paywall model | **Design free, gate publish.** A new user builds ONE draft profile and sees a live preview immediately; nothing is public and no card exists until payment. |
| Free plan | **Removed.** No free tier. Publishing requires a purchased identity. |
| Existing users | **Grandfathered** — profiles that already work keep working. |
| Offline sales | **Staff can mark an order paid** (ops console) **+ Corporate "Talk to Sales" quote flow.** |
| Segments | **Marketing only.** Checkout asks quantity, not plan. Do not reintroduce per-account plans. |

## Why "design free, gate publish" rather than a hard paywall

Asking for KES 1,500 before the customer has built anything is the highest-friction
possible order: they pay before experiencing the product. Letting them spend five minutes
adding their logo, WhatsApp and review link — then hitting "Activate: buy your card" —
uses the endowment effect to do the selling. Operationally it is identical to a hard
paywall: nothing is public, no token is drawn, no identity term starts until payment
clears. The draft is the demo.

## Payment-collection improvements for first-time buyers (baked into the prompt)

These are where most Kenyan M-Pesa checkouts lose money:

1. **Poll the STK status.** Don't leave a spinner. Use Daraja's query endpoint plus the
   callback so the UI resolves to success/failure/timeout on its own.
2. **A real "check your phone" state** with a countdown, a plain explanation, and a
   one-tap **Resend prompt**.
3. **A manual fallback** if STK fails: show the Paybill/Till and the exact reference to
   type, then let staff reconcile it. STK fails often (no network, PIN timeout, SIM issues).
4. **Collect delivery/design details AFTER payment, not before.** Every field before the
   money is abandonment. Take payment, then ask where to ship it.
5. **Prefill and validate the phone number** (accept 07…, 01…, +254…) — never make them
   retype it.
6. **Resume, don't restart.** A pending order is waiting for them when they come back;
   the dashboard shows "Finish your payment".
7. **Show the M-Pesa receipt code** on success and keep it in payment history.
8. **One tap from empty state to checkout** with quantity pre-set to 1.

## Ready-to-paste Claude Code prompt

```
You are the engineering partner for Hornbill TapTap (read CLAUDE.md, PROJECT.md, and
docs/decision-log.md first, especially D-018 on per-identity pricing). We are starting
Sprint 7 - Purchase-Gated Activation. Operate under the repo's sprint governance:
AUDIT -> PLAN -> then STOP for my approval before implementing anything.

GOAL: remove the free tier. A profile can be BUILT free, but it can only be PUBLISHED
(reachable at its slug, linked to a card/stand) once the customer has paid for an
identity. Make buying the obvious, easy, single next step for a new user.

FIRST, AUDIT and report back (read the code, do not assume names): the free/plan remnants
across lib/pricing.ts, lib/plans.ts if it still exists, lib/identity.ts, lib/billing-context.ts;
the smart_pages model and how is_active / publishing works today; nfc_tags and term_end;
the payments + payment_tags + orders tables and app/api/mpesa/callback (activateIdentities);
the dashboard empty state and navigation; the ops console at /admin; and every place a
"free" plan is still assumed. Report what must change before changing it.

THE MODEL (do not deviate):
- NO FREE PLAN anywhere in product, code or copy.
- A new account may create exactly ONE DRAFT profile and edit/preview it fully. A draft is
  NOT public: its slug must NOT resolve publicly, and it must not be claimable by a card.
- PUBLISHING requires an available paid identity. Paying provisions the identity
  (nfc_tags row, term_start = now, term_end = now + 12 months) and unlocks publishing.
- One identity = one publishable profile. Want a second profile? Buy a second identity.
- Prices stay in lib/pricing.ts (D-018): Smart Card KES 1,500, Smart Stand KES 2,000, each
  including the first 12 months; renewal KES 1,000 per active identity per year. Checkout
  asks WHICH PRODUCT and HOW MANY. Individual/Business/Corporate are MARKETING SEGMENTS on
  the pricing page only - do NOT store them on the account and do NOT reintroduce
  per-account plans, plan_code gating or maxProfiles.

GRANDFATHERING (must not break anyone): accounts that already have a published/working
profile keep it working exactly as-is. Write the migration and the entitlement check so
existing profiles are treated as already-entitled. New accounts get the new rule. Make this
explicit and tested - do not silently unpublish anyone.

NEW-USER JOURNEY (the heart of this sprint):
1. Sign up -> land in the dashboard.
2. The dashboard's primary CTA is unmissable: "Buy your card" (or "Activate your profile"),
   routing straight to checkout. Any secondary action is visually subordinate.
3. They may build their one draft profile immediately, with a live preview and a persistent,
   honest banner: "Draft - not live yet. Activate to publish." plus the buy CTA.
4. Every publish/share/QR/claim action on a draft opens the same checkout, explaining in one
   line what they get.
5. After payment succeeds -> the identity is provisioned, the profile can publish, and they
   are taken to a short success state that confirms what happens next (card production and
   delivery).

CHECKOUT + PAYMENT UX (make this excellent - this is where Kenyan checkouts lose money):
- One tap from the dashboard empty state to checkout, quantity pre-set to 1.
- Ask for as little as possible BEFORE payment. Collect delivery/design details AFTER the
  payment succeeds, not before.
- Phone input accepts 07..., 01..., +254... and normalises (reuse normalizePhone in
  lib/mpesa.ts). Prefill anything already known.
- After initiating STK: a real waiting state - "Check your phone and enter your M-Pesa PIN"
  - with a countdown, and POLL the payment status (use Daraja's STK query endpoint plus the
  existing callback) so the UI resolves itself to success / failed / timed out. Never leave
  an indefinite spinner.
- Offer "Resend prompt" and, if STK keeps failing, a MANUAL FALLBACK showing the Paybill/Till
  and the exact reference to enter, flagged for staff reconciliation.
- Pending orders are resumable: returning users see "Finish your payment" rather than
  starting over. Never double-charge; keep the callback idempotent (payment_tags already
  makes replay safe - reuse it).
- On success show the M-Pesa receipt code and keep it in payment history.

OFFLINE + SALES-LED PATHS (both required):
- STAFF MARK AS PAID: in the staff ops console, staff can record an offline payment (cash,
  bank, in-person) against an order, which provisions the identity through the SAME code
  path as an M-Pesa payment. Record who did it and when (append-only audit). Never expose
  this to customers.
- CORPORATE QUOTE FLOW: a "Talk to Sales" request (name, company, contact, rough quantity,
  notes) creates a lead/quote request visible to staff, who create the order and invoice.
  Do not force 30-identity buyers through self-checkout.

ENFORCEMENT (must be server-side, not just UI):
- The public slug route and the tag claim path must refuse unpublished/unentitled profiles.
- Publishing must be checked in the server action AND enforced by RLS/DB constraint where
  practical. A user must not be able to publish by calling the API directly.
- Removing the free plan must not weaken any existing RLS policy.

COPY: no "free plan" language anywhere. Be honest and warm: draft profiles are "not live
yet", not "locked". Follow the existing marketing voice rules in docs/landing-page-copy.md
(no em dashes in customer-facing copy; the marketing test enforces this). Update the public
pricing/landing copy if it still implies a free tier.

NON-FUNCTIONAL: reuse the existing design system and the existing payment code path (do NOT
write a second payment flow); real data only; server-side enforcement; keep dashboard,
analytics, leads, ops console and NFC claim working; do not weaken RLS; do not change
prices. Tests required for: the entitlement rule (draft vs published), grandfathering,
publish enforcement server-side, payment-status polling states, and staff mark-as-paid
provisioning through the shared path.

DELIVERABLES: a Sprint 7 plan doc; the migration (entitlement + grandfathering); the gated
publish flow; the new-user dashboard CTA and draft banner; the checkout with polling,
resend and manual fallback; staff mark-as-paid; the corporate quote request; updated copy;
and tests. Record the decisions (no free tier; design-free/gate-publish; grandfathering;
segments are marketing-only) in docs/decision-log.md.

Follow AUDIT -> PLAN -> STOP: present the plan, including exactly how you will grandfather
existing users and enforce publishing server-side, and WAIT for my approval before building.
```
