# Hornbill TapTap — Decision Log

ADR-lite record of decisions. Newest context lives here; the charter (`PROJECT.md`)
carries the one-line summary. Status: **Accepted**, **Proposed** (awaiting your
confirmation), or **Superseded**.

---

### D-001 — MVP wedge is a single "Smart Profile" engine
**Date:** 2026-07-22 · **Status:** Accepted

**Context:** The master prompt lists ~13 product categories. Building all of them
solo is infeasible and would delay revenue indefinitely.

**Decision:** The MVP is one engine — a permanent slug that renders as a digital
business card / multi-action landing page **or** a single-destination redirect
(Google review, socials, WhatsApp, etc.). All other product categories become
templates on this engine, post-PMF.

**Consequences:** Massively reduced scope; a data model built around a flexible
`smart_pages.config`; new products later require templates, not new systems.

---

### D-002 — Beachhead-first build posture
**Date:** 2026-07-22 · **Status:** Accepted

**Context:** The prompt says both "design for scale from day one" and "adapt to SME
reality." Premature scaling is a top startup killer.

**Decision:** Architect with clean seams and a well-modeled DB, but build only what
the beachhead needs. Add scale (multi-region, heavy caching, RBAC) when load/revenue
demands it.

**Consequences:** Faster shipping; some scale work deliberately deferred and tracked.

---

### D-003 — Next.js + Supabase only (no standalone Express)
**Date:** 2026-07-22 · **Status:** Accepted

**Context:** The prompt specified Next.js **and** a separate Node/Express backend
**and** Supabase — redundant, doubling deploy surface and splitting auth.

**Decision:** Use Next.js route handlers + Supabase (Postgres, Auth, RLS, Edge
Functions). No standalone Express service. Add a dedicated **edge-cached redirect
service** for the tap target.

**Consequences:** One deploy surface, one auth model, less ops for a solo founder.
Revisit only if a workload genuinely needs a long-running dedicated service.

---

### D-004 — Solo, bootstrapped resourcing
**Date:** 2026-07-22 · **Status:** Accepted

**Context:** Founder is building solo without outside funding.

**Decision:** Optimize hard for speed, low cost, managed services, and minimal ops.
Buy/borrow peripheral capabilities; build only the core engine.

**Consequences:** Ruthless scope discipline; managed platforms (Vercel, Supabase)
over self-hosted; billing and analytics kept simple in v1.

---

### D-005 — Storage: Supabase Storage over Cloudinary
**Date:** 2026-07-22 · **Status:** Accepted (confirmed 2026-07-22)

**Context:** The prompt lists Cloudinary. Solo founders benefit from fewer vendors.

**Decision:** Use Supabase Storage for images/logos/vCards in v1 to keep
one platform, one bill, one auth model. Add Cloudinary later only if its image
transformation pipeline becomes necessary.

---

### D-006 — Billing model: annual-first, defer M-Pesa Ratiba
**Date:** 2026-07-22 · **Status:** Accepted (confirmed 2026-07-22)

**Context:** True recurring billing in Kenya is harder than card markets. M-Pesa
**Ratiba** (standing orders) supports recurring debits but is customer-initiated and
fixed-amount; integrating it solo adds complexity.

**Decision:** v1 = annual plans via M-Pesa STK push and/or Paystack card
subscriptions. Add Ratiba-based recurring once revenue justifies the effort.

---

### D-007 — Run TapTap on the `taptap.hornbilltech.co.ke` subdomain
**Date:** 2026-07-22 · **Status:** Accepted

**Context:** Hornbill owns `hornbilltech.co.ke`, but the root domain already hosts a
separate project. TapTap needs a permanent, brandable home for slug URLs.

**Decision:** Host TapTap on the **`taptap.hornbilltech.co.ke`** subdomain. It is not
yet configured — DNS + SSL wiring is a Sprint 1 task. Public slug URLs take the form
`https://taptap.hornbilltech.co.ke/<slug>`.

**Consequences:** No conflict with the existing root-domain project; a short, separate
tap-URL domain remains an optional later optimization.

---

### D-008 — Pin Next.js 14.2.35 now; migrate to a supported major early
**Date:** 2026-07-22 · **Status:** Accepted (with follow-up)

**Context:** Sprint 1 scaffolded on Next.js 14. Next.js 14 reached end-of-life on
2025-10-26; 14.2.35 (2025-12-11) is its final security patch, so v14 will not receive
fixes for newly disclosed CVEs.

**Decision:** Pin `next@14.2.35` for the current build to stay on the most-patched v14.
Schedule a migration to a supported Next major (15+) as an early tech-debt task —
cheapest to do now while the codebase is small (a handful of routes). The v15/React 19
migration touches async `cookies()`, route `params`, and `useFormState` →
`useActionState`.

**Consequences:** Unblocks a clean build today; a tracked, bounded migration follows
before we build significantly more on v14.

**Update (2026-07-22, Sprint 2 Step 0):** Migrated to **Next 16.2 (Active LTS) + React
19** (Next 15 is only maintenance LTS until Oct 2026, so we jumped straight to 16.2).
Bumped deps and updated async `cookies()`, async route `params`, and `useFormState` →
`useActionState`. Pending green-build verification on Vercel.

---

### D-009 — Token-based NFC tag identity (keep slugs for sharing)
**Date:** 2026-07-24 · **Status:** Accepted (my recommendation, confirm if you disagree)

**Context:** Physical tags need an identity that survives repointing and supports a
hardware-as-CAC inventory model (bulk-encode blank cards, sell, let customers self-claim).

**Decision:** Encode NFC/printed cards with a permanent random **token URL**
`/t/<token>` that resolves to the owner's currently-bound smart page. Keep human-friendly
**slugs** (`/business-name`) for QR/social/link sharing. The two coexist: tokens =
hardware identity, slugs = shareable brand identity.

**Why (scalability):** lets us pre-encode blank card batches before a buyer exists;
supports claim / rebind / transfer / deactivate (lost card) without re-encoding; gives
per-card analytics; tokens are opaque/revocable (slugs are guessable). Cost: one extra
indexed lookup on the tap path (cache later). This is the standard approach for platforms
selling NFC hardware at scale.

**Consequences:** `nfc_tags` gains a token; a `/t/[token]` route + claim flow; an admin
provisioning tool. Slug routing is unchanged.

---

### D-010 — Supabase publishable/secret keys; `.env.example` is placeholders only
**Date:** 2026-08-14 · **Status:** Accepted (prompted by a credential exposure)

**Context:** A live Supabase `service_role` key was committed to `.env.example` in
`c8df1a7` (Sprint 4) and pushed to the **public** repo, where it stayed until `ceb0b79`
(2026-08-13) — roughly three weeks. That key bypasses RLS on every table, including
`leads`, which holds customer PII. The Sprint 4 closeout recorded the "env vars belong in
`.env.local`, not `.env.example`" lesson as resolved, but the file was never actually
cleaned — the lesson was written down and not applied.

**Decision:** (1) Rotate onto Supabase's **publishable/secret** key model rather than
rolling the legacy JWT secret, then disable the legacy `anon` + `service_role` pair.
(2) `.env.example` is a committed template that carries **placeholder values only** —
real values live in `.env.local` (gitignored) and in Vercel.

**Why publishable/secret over a JWT-secret roll:** secret keys are individually
revocable, so a future leak means killing one key rather than regenerating everything.
Rolling the legacy JWT secret would also invalidate every issued user access token,
signing out all users — survivable at pilot scale, not after launch. Env var *names* are
unchanged (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), so no code
changes: renaming would touch all five `lib/supabase/*.ts` consumers plus Vercel for
purely cosmetic gain.

**Consequences:** README and `.env.example` describe the API Keys page and the
publishable/secret vocabulary. The exposed key remains in git history but is inert once
revoked; history rewriting is optional cleanup, not the fix. Any pre-commit secret check
must match unquoted `KEY=value` env lines, not just quoted assignments in source.

---

### D-011 — Design system is vendored Radix + CVA, not a component framework
**Date:** 2026-08-15 · **Status:** Accepted

**Context:** The UI transformation needs ~26 reusable components at WCAG 2.2 AA. CLAUDE.md
§3 forbids introducing a large component framework without first proving Tailwind can't
carry the design system. Today there is no `components/ui/` layer at all and the same
utility strings are duplicated across ~20 sites.

**Decision:** Build `components/ui/` by **vendoring** component source into the repo
(shadcn-style), composed over headless `@radix-ui/react-*` primitives, with variants typed
via `class-variance-authority`. Hornbill owns every component file; Radix contributes only
behavior — focus traps, roving tabindex, ARIA wiring.

**Why not hand-roll:** focus trapping, roving tabindex, `aria-expanded` wiring, layered
Escape/outside-click and scroll-lock are solved problems and the usual source of a11y
regressions. Why not a styled framework (MUI/Chakra/Mantine): they impose a theme system we
would fight, and ship far more than we need. Radix is unstyled, per-primitive and
tree-shakeable (~35–45KB for the seven we use), so it is not the "large framework" §3 warns
about.

**Consequences:** components are editable in-repo, no upgrade lock-in. `components/ui/`
becomes the only place base styling is declared.

---

### D-012 — Brand orange split into a fill token and an AA-safe text/button token
**Date:** 2026-08-15 · **Status:** Accepted

**Context:** Hornbill orange sampled from the reference mockup is `#F97316`. Computed
against WCAG relative luminance, **white on `#F97316` is 2.80:1** — it fails AA for normal
text *and* misses the 3:1 large-text floor. The mockup uses white-on-vivid-orange for the
primary button on nearly every screen. CLAUDE.md §24 targets WCAG 2.2 AA and §30.15 makes
it non-negotiable, so the reference cannot be followed literally here.

**Decision:** Split the accent into two tokens.
`--primary` = `#F97316` for fills that carry **no text** (sparklines, chart bars, toggle-on,
status dots, icon tiles, progress, mobile FAB, focus rings).
`--primary-strong` = `#C2560A` for **button fills with white labels** (4.53:1) and for any
orange **text** on white. Large hero CTAs on public pages may keep vivid `#F97316` with
charcoal `#1A1A1A` text (6.21:1).

Same audit retires `text-green-600` `#16A34A` (**3.30:1**, currently used for "current plan"
and success messages) in favour of `#15803D` (5.01:1), and `text-neutral-400` (2.52:1).
`text-red-600` (4.83:1) and `text-neutral-500` (4.74:1) pass and stay.

**Consequences:** the product still reads as vividly orange — the accent is unchanged
wherever it appears without text. Every token pairing is contrast-verified before use.

---

### D-013 — App routes nest under `/dashboard/*`; the root catch-all forces slug reservation
**Date:** 2026-08-15 · **Status:** Accepted

**Context:** The new sidebar IA needs routes for profiles, devices, analytics, customers and
settings. `/[slug]` is a **root catch-all**, so every top-level route permanently consumes a
customer-facing name.

**Decision:** Nest all authenticated routes under `/dashboard/*`. Zero collision risk, and
`middleware.ts`'s existing `/dashboard/:path*` matcher covers them unchanged.

**Separately and urgently:** `RESERVED_SLUGS` is missing `analytics`, `customers`, `devices`,
`leads`, `qr`, `cards`, `team`, `insights`, `nfc` and `notifications`. These must be reserved
in UI-1 — free before launch, breaking once a customer owns one.

**Consequences:** slightly longer URLs than the mockup implies; route moves in UI-2 need
redirects from the existing `/dashboard/[id]/*` paths.

---

### D-014 — Inter via `next/font`, self-hosted
**Date:** 2026-08-15 · **Status:** Accepted

**Context:** No font-family is declared anywhere in the codebase — the product currently
renders in each device's system UI face, so it looks different on every phone and reads as
generic against the premium target.

**Decision:** Inter, self-hosted through `next/font`. Tabular numerals for all metrics.

**Why:** `next/font` self-hosts and pre-loads, so there is no external request, no FOUT, no
layout shift and no CSP concern. Inter stays legible at small sizes on low-end Android, which
matters for the Kenyan SME market. No dependency is added — `next/font` ships with Next.

---

### D-015 — A lead is a submission, not a deduplicated person
**Date:** 2026-08-15 · **Status:** Accepted (reversible)

**Context:** UI-8 turns the lead inbox into a workflow, which forces a question that
decides whether TapTap is heading toward a CRM: does "Customers" mean *people*
(deduplicated across submissions, with their own lifecycle) or *submissions*?

**Decision:** A lead stays a **submission**. `leads` gains `status`, `note` and
`updated_at`; no `contacts` table is introduced. Repeat enquiries are surfaced by
counting other submissions sharing a phone or email at query time, so an owner still
sees "3 previous enquiries" without a second entity existing.

**Why:** duplicate submissions are rare at SME scale, and every field needed to
promote submissions into contacts is already captured — so this stays reversible.
Building the contact lifecycle now would be the premature expansion §19 and §30.19
warn against, and it would commit the product to a CRM shape before a single customer
has asked for one. Grouping at query time also means no migration is wasted if the
answer turns out to be different.

**Consequences:** status is per-submission, so a person who enquires twice has two
statuses — correct for a follow-up workflow, wrong for a relationship view. When
customers start asking for the relationship view, promote to a `contacts` table with
submissions linked to it; the existing rows carry everything that migration needs.

**Related:** the same migration adds the missing `leads` UPDATE policy and restricts
it by column grant, so owners annotate but cannot rewrite what a customer submitted —
see the migration header for why that distinction matters legally as well as
technically.

---

### D-016 — Insights are deterministic rules, and are not called AI
**Date:** 2026-08-15 · **Status:** Accepted

**Context:** UI-0 sequenced an "AI" sprint and hard-blocked it on trustworthy data. UI-6
and UI-7 supplied that data — source attribution, per-card taps, a real click-versus-
confirmed split. The question at UI-10 was therefore what to build on it, not whether.

**Decision:** Ship **Insights**: a rule engine over counts, with every finding carrying
the numbers it was derived from and a link to the screen that proves them. No language
model, and the word "AI" is not used in the product surface.

**Why:** everything genuinely useful here is computable and provable — an action
outperforming those ranked above it, a card silent while its siblings are busy, a page
with traffic but no clicks, buttons that go nowhere, leads left waiting. A model would
add phrasing, not knowledge, and §30.8 explicitly forbids presenting hard-coded analysis
as AI. Labelling rules "AI" would also make them harder to trust: an owner can argue with
a stated number, but not with an oracle.

**Consequences:** two rules govern every finding — never speak from noise (each rule has
a minimum volume, so the product does not advise rearranging a page on three clicks), and
every claim shows its evidence. Findings can be dismissed, because a suggestion an owner
has rejected must not keep returning. Thresholds live in `lib/insights.ts` beside the
rules, so the whole of what the product will claim is reviewable in one file and testable
without a database.

**When a model would earn its place:** genuine anomaly detection over a long history,
natural-language questions about the data, or generating page copy. All three are real,
none is available from counts, and each should be a separate decision made against this
working baseline rather than a label applied to if-statements.

---

### D-017 — One account per business; members deferred, sub-accounts rejected
**Date:** 2026-08-15 · **Status:** Accepted

**Context:** the first corporate customer — Magangi and Company, Certified Public
Accountants — bought three cards for three people at one firm. That raised whether the
platform needs a company account with **sub-accounts** beneath it, on the belief that the
schema is locked to one user per account and would have to be reworked.

**The belief was wrong, in a useful direction.** `0001_init.sql:19` comments "v1 = one user
per account", but nothing enforces it: `profiles.account_id` is a plain indexed foreign key
with **no unique constraint**, and all 15 RLS policies are written as set-membership tests —
`account_id in (select account_id from public.profiles where id = auth.uid())`. That
predicate returns one row today and would return N rows just as correctly. `profiles` is
already a membership table that has never had a second row inserted.

**Decision:** a business is **one account with many members**, never a parent/child account
hierarchy. Team management (roles, invites, per-page assignment, UI) is **deferred, not
designed away** — the schema already accommodates it additively.

**Why sub-accounts were rejected:**
- `subscriptions.account_id` is UNIQUE (`0001_init.sql:76`) — one subscription per account.
  A hierarchy fragments billing with no answer to who pays.
- ~25 ownership call sites do `.eq("account_id", profile.account_id)` against a single
  value. Roll-up would need recursion in every one.
- All 15 RLS policies would become recursive, which is slow and is where tenant-isolation
  bugs come from.
- It solves a problem the customer does not have. Magangi is one business with three staff,
  not a holding company of three businesses.

**What Magangi actually needed, and already had:** one account, three `smart_pages`, three
`nfc_tags` each claimed to a different page, one manager maintaining all three, per-card
analytics via `events.tag_id`. Zero code. The only gate was the plan limit — `maxProfiles`
is 1 on Free and Starter, so three profiles requires Pro.

**Consequences:** when team management is eventually built it is **members and roles on a
single account** — `profiles.role`, an invites table, a nullable `smart_pages.owner_profile_id`
for scoping a staff member to their own card, and a `handle_new_user()` that joins a pending
invite instead of always minting a new account. None of that unwinds anything here.

**The genuinely different case, kept separate:** a reseller or Hornbill partner
administering many *separate* client businesses, each with its own plan and invoice. That is
not this, it has different billing, and building a hierarchy now would prejudge it wrongly.

**Open, and not a schema question:** plans meter Tap Profiles, not people, so a three-person
firm lands on Pro purely on profile count. Per-seat pricing is the usual corporate shape and
should be decided deliberately against the still-DRAFT prices rather than discovered during
a sale.

---

### D-018 — Billing is per identity, not per account plan
**Date:** 2026-08-30 · **Status:** Accepted · **Revises:** D-006

**Context:** billing had been per-account plan tiers since Sprint 4 — Free/Starter/Pro/
Business, gated on `maxProfiles`, at draft prices of KES 5k/15k/40k. The real commercial
model is per device: a customer buys a Smart Card (KES 1,500) or Smart Stand (KES 2,000),
the price **includes the first twelve months**, and each active device renews at
**KES 1,000 per year** from year two. Segments — Professional, Business, Commercial — are
packaging, not count-gates.

**Decision:** the billing unit is a **TapTap identity**, and an identity is the **tag**,
not the (tag, page) pair.

**Why the tag and not the pair:** `nfc_tags.smart_page_id` is deliberately repointable
(D-009), and repointing a card without re-encoding it is the core product promise — proven
on real hardware in August. If the pair were the billing unit, every repoint would destroy
and recreate a billing unit. The page is merely what the identity currently points at.

**Consolidated renewal is an action, not a stored date.** "All identities share one renewal
date" cannot coexist with "hardware includes twelve months": a card bought in month seven
either gets five months instead of twelve, or drags every earlier card along free, or needs
pro-rating that produces M-Pesa amounts like KES 583. So each identity stores its **true**
`term_end`, and the billing screen offers one payment over everything falling due —
`count × 1,000`, one STK prompt. The account-level renewal date is **derived** (`min(term_end)`),
never stored, because a second copy of a date is a second thing that can be wrong.

**Enforcement is real, and it is graceful.** A lapsed identity stops resolving, and the page
its devices point at serves a branded "this card isn't active right now" screen rather than
a 404 — the reader is almost always the *cardholder's customer*, someone who never had the
chance to pay, and a 404 reads as broken. A **14-day grace window** sits past `term_end`, and
taps on a lapsed card are still logged: people still tapping a dead card is the strongest
argument for renewing it, and dropping the event would hide that.

**Free means free, up to a point.** Building and publishing a profile costs nothing — that is
the funnel Sprint 6 depends on. What a zero-identity account does *not* get is **lead capture**
and the **full analytics report** (attribution, per-card, location, timing, CSV). Without that
line the entire software product is obtainable by sharing a slug and never buying hardware,
on a product whose main distribution channel is WhatsApp. `maxProfiles` is replaced by an
anti-abuse cap of 25 that is never advertised as a limit.

**Two fictions were closed rather than carried forward.** The audit found `customBranding`
and `advancedAnalytics` had been listed on the billing page since Sprint 4 and enforced
nowhere — "Powered by Hornbill TapTap" rendered for every account, paying or not, and the
full report was available to everyone. Both gates are now real. Conversely, **Commercial is
not sold an "advanced analytics" tier**, because none exists yet: it is sold on team access,
multi-location and priority support, which are things we can actually point at. §15 and
§30.7 rule out listing capability we have not shipped.

**Consequences:** `subscriptions` is no longer read by the app (the table and its signup
trigger are left alone — data preserved, cleanup deferred to Sprint 6). `payments` gains
`kind` + `quantity`, and `payment_tags` records exactly which identities a payment covered —
required for correctness, not reporting, because it is what makes a replayed M-Pesa callback
extend the same set rather than a recomputed one. `accounts.plan` was dropped after grep
confirmed nothing had ever read it. `lib/plans.ts` is deleted; `lib/pricing.ts` holds the
money and `lib/identity.ts` the state machine, which is the UI-9 `subscriptionState` shape
moved down one level — including its fail-open rule, so a device with no recorded term stays
live rather than going dark over a missing timestamp.

**Open, and deliberately not decided here:** paid accounts holding zero claimed devices
convert to no identities at all. Nothing invents an identity for a device that does not
physically exist; the Phase 0 reconciliation query lists them for a per-account decision.

---

### D-019 — The Order is the spine; identity terms start at payment
**Date:** 2026-08-30 · **Status:** Accepted · **Builds on:** D-018

**Context:** D-018 priced hardware and built no way to buy it. Every card sold was a manual
conversation followed by an untracked production job — which works for one customer and
becomes chaos at ten.

**Decision:** an **Order** is created at checkout, its payment provisions the identities it
bought, and staff fulfil it through an enforced pipeline. Sprint 6b builds the
customer-facing half; the operations console is 6c.

**Fulfilment and payment are separate state machines**, joined only in the views. An order
sits at `new` from creation; whether it has been paid for is a fact about its payment row.
Collapsing them would mean inventing statuses like `paid_but_not_started` and keeping them
in step with Daraja, which is how a flat status ends up lying. The customer-facing label is
computed from both, so an unpaid order never reads as "Paid".

**Terms start at PAYMENT, not delivery.** Considered and rejected: starting the twelve
months when the card is delivered is fairer — production time otherwise comes out of the
customer's year, so a three-week build delivers 49 weeks for a 52-week price. Payment-start
was chosen for simplicity: it is what the callback already did, and it needs no new
entitlement states. **This is the decision most likely to want revisiting**, and it can be,
by crediting production days at delivery without any schema change.

**It creates one hazard that delivery-start would not have**, and that hazard is handled in
the database rather than in application code: a cancelled or refunded order would otherwise
leave a live, working card behind, paid for with money that has been given back. A trigger
on `orders` disables the identities a cancelled order provisioned, so it holds whoever
cancels and through whichever path.

**Staff are their own table, not `profiles.role`.** D-017 reserves a per-account role for
team management; Hornbill's own staff are not members of any customer account. Conflating
the two axes would poison the team-management design before it is built. The shared
`ADMIN_TOKEN` is retained only for card minting: it is a single secret with no identity, so
"who moved this order" is unanswerable under it — which makes an audit log impossible.

**The audit log is a trigger, not a convention.** "Audit every transition" is only true if a
transition cannot happen without one. Application code writing its own audit row is a habit
that a future path will forget; a trigger survives it. Transition **legality** stays in
`lib/orders.ts` where it is tested — the database guarantees the record, the code guarantees
the rule, and neither duplicates the other.

**`products` has no price column.** `lib/pricing.ts` is the single source of truth for money
(D-018) and a second copy in the database is a second number that can be wrong, with the
wrong one silently winning at checkout. The table carries catalogue metadata; `orders.amount_kes`
records what was actually charged, so a price change never rewrites history.

**Ordering requires signing in.** The original brief allowed guest orders with a nullable
`account_id`. Rejected: an order belonging to nobody cannot provision an identity, which is
the entire purpose of an order. Signing up is free and instant. It also avoids reserving a
new root-level slug — `/[slug]` is a root catch-all (D-013) and `checkout`, `orders`, `ops`
and `staff` are all still claimable by customers.

**Token selection is atomic in the database.** `provision_identities` draws from the
pre-minted pool with `for update skip locked`, so two concurrent callbacks cannot hand the
same physical card to two customers, and mints the remainder if the pool is short — running
out of blanks must never fail a payment already taken.

---

### D-020 — The board advances by menu, not by drag; staff auth replaces the shared token
**Date:** 2026-08-30 · **Status:** Accepted · **Builds on:** D-019

**Context:** 6b made hardware buyable and left fulfilment to be advanced by hand in SQL. The
console is what makes that a job rather than a chore. The original brief specified a
production **Kanban** with drag-and-drop.

**Decision: no drag.** The board keeps its columns, counts, ageing and stuck flags, but a
card moves via a control listing only the moves `allowedTransitions()` permits.

**Why, and this is not the lazy reading:** transitions are **constrained**. Most drops onto
most columns would have to be refused — you cannot drag a `new` order onto `dispatched` —
and an interaction whose answer is usually "no" is a bad interaction regardless of how it
looks. Rendering only the legal moves makes an illegal one *unreachable* rather than
*rejected*. It is also the accessible option rather than a fallback to one: multi-container
dnd-kit is the library's hardest area, cross-column keyboard support harder still, and §24
does not accept a board that works properly only with a mouse. dnd-kit stays a dependency
for the profile builder, which is single-container vertical sort and a genuinely good fit.

**The whole `/admin` area now requires a `staff` row.** `ADMIN_TOKEN` survives as a *second*
factor on minting alone. It was never fit to gate a multi-user tool: one shared secret with
no identity cannot answer "who moved this order", which makes the `order_events` audit log
worthless, and its rate limiter is in-memory per serverless instance. The gate lives in the
layout rather than per page, so a new route cannot be added unprotected by omission.

**`requireStaff` fails CLOSED on a missing schema**, the opposite of the choice
`loadBillingContext` makes. That asymmetry is deliberate: over-granting a customer their own
paid features for a few minutes during a migration is a shrug; over-granting access to every
customer's orders is not.

**`orders_overview` is a view with `security_invoker = true`.** Without it a Postgres view
runs with its owner's privileges and silently bypasses the RLS on the tables underneath —
which would have exposed every customer's orders to every signed-in user. With invoker
rights it inherits `orders_select_own` exactly: staff see all, a customer sees their own.

**Stuck and stage counts are computed in TypeScript, not SQL.** `ops_overview()` returns only
what genuinely needs the database — counts over tables that grow without limit, and the
cross-account reconciliation list. Open orders are few by definition, so the console reads
them and applies the tested `isStuck()`. A second copy of that rule in SQL would drift from
the first, and the rule is the kind that gets tuned.

**Consequences:** `Table` and `Pagination` finally exist as design-system primitives — listed
in §9 since UI-1 and never built, because until now every list was a customer looking at a
handful of their own records, which a card list serves better. Orders are the first case a
card list genuinely cannot serve. Both are reusable well beyond ops.

**The D-018 reconciliation leftover now has a home:** accounts on a legacy paid plan holding
no devices are listed on the ops overview, where they can actually be worked off rather than
living in a query someone has to remember to run.

---

### D-021 — No free tier; the gate is publishing, not building
**Date:** 2026-09-02 · **Status:** Accepted · **Revises:** the "free means free" clause of D-018

**Context:** D-018 decided that "building and publishing a profile costs nothing — that is
the funnel Sprint 6 depends on", and gated only lead capture and the full analytics report.
The audit for this sprint found what that meant in practice: `smart_pages.status` has
defaulted to `'published'` since 0009, so a profile created thirty seconds after signup
resolves publicly at its slug, forever, for nothing. The entire software product was
obtainable by sharing a slug and never buying hardware, on a product whose main
distribution channel is WhatsApp.

**Decision:** a profile is **built** for nothing and **published** against a paid identity.
Everything else D-018 decided stands: the billing unit is still the tag, prices are
unchanged, terms are still per identity, and consolidated renewal is still an action rather
than a stored date.

**Why the gate is publishing and not building.** Gating creation would mean asking someone
to pay for something they have never seen. A draft is how a customer finds out whether the
product is any good, and it costs us a database row. The moment worth charging for is the
moment the thing becomes useful to them, which is when it is on the internet with a card
pointing at it.

**Why a draft 404s and a lapsed page does not.** They look similar and are not. The
inactive notice exists to reassure the *cardholder's customer* — someone handed a card that
suddenly stopped working, who never had the chance to pay — that the business is not
broken. Nobody has ever been handed a draft, so there is nobody to reassure, and inventing a
"this business has not paid yet" screen for a page that was never public would leak the
owner's billing state to strangers.

**Enforcement is four-layered, and layer two is the one that was missing.**
`publish_page()` checks entitlement; column grants stop a direct PostgREST write; a trigger
holds even against the service role; and `page_is_live()` decides what the public sees.
Until this sprint `authenticated` held a table-wide UPDATE grant on `smart_pages` from
0001, so `PATCH /rest/v1/smart_pages {"status":"published"}` would have published anything
the caller owned whatever the RPC said. 0007 solved exactly this on `accounts` with
column-level grants; `smart_pages` never got the same treatment. A gate in the RPC alone
would have been decoration.

**Consequences:** new pages are born `draft`. `claim_tag` and the device rebind path refuse
an unpublished page, because a card pointing at a 404 fails in front of the cardholder's
customer. Checkout moved out of the billing page to `/dashboard/checkout` so there is
exactly one place money can be taken from, and the M-Pesa provisioning logic left the
callback route for `lib/provisioning.ts` so the status poll and staff mark-as-paid run the
identical path rather than a second implementation of it.

**What was NOT gated, deliberately:** `app/api/qr/[slug]` still serves any slug. It is a
pure encoder that never touches the database — it turns a string into a picture — so
gating it would protect nothing, and the URL it encodes is public knowledge. What is gated
is the page the QR points at, and the UI does not offer to share a link that does not
resolve. A check there would have looked like security without being any.

---

### D-022 — Entitlement is a slot count, not a device binding
**Date:** 2026-09-02 · **Status:** Accepted · **Builds on:** D-021

**Context:** "one identity, one publishable profile" has an obvious implementation —
publishing sets `nfc_tags.smart_page_id`, making the rule a literal foreign key.

**Decision:** publishing consumes a **slot**, counted as
`published, non-grandfathered pages < live identities`. No binding is created.

**Why not the binding.** Two reasons, both structural. `provision_identities` gives a paying
customer live identity rows at the moment of payment, **weeks before the physical card is
produced and delivered**; a binding rule would make publishing wait on manufacturing, which
is precisely the delay the customer is paying to skip. And repointing a card without
re-encoding it is the core product promise (D-009, proven on real hardware in August) — if
the binding carried the entitlement, every repoint would silently move which page is allowed
to be live. Counting keeps publishing and repointing independent, which is the property that
made the promise worth making.

**The one place ordering matters.** When an account with two cards lets one lapse, *which*
of its two pages goes dark must be a fact rather than a race. `page_is_live()` ranks an
account's published pages by `published_at` ascending and keeps the first N, so the oldest
survives — the one most likely to already be printed on something.

**A behaviour change worth naming:** previously a page whose own bound card had lapsed went
dark even when the account held another live card. The account's slot count now decides, so
that page stays live and a different one goes dark instead. The lapsed *physical card* still
fails correctly at `/t/<token>`, because `resolve_tag` checks `identity_is_live()` on the
tag itself and that is unchanged.

---

### D-023 — Grandfathering is a stored flag on the page
**Date:** 2026-09-02 · **Status:** Accepted · **Builds on:** D-021

**Context:** changing the rule mid-flight risks the one outcome that would be genuinely
harmful: a customer who is live today waking up unpublished because we changed our pricing
model.

**Decision:** `smart_pages.entitlement_grandfathered`, set by 0019 for every page that was
`published` at the moment the migration ran. Such a page publishes and resolves without
consuming a slot, permanently.

**Why a stored flag rather than a date rule.** "Created before 2 September 2026" has to be
re-argued every time someone reads it, cannot be corrected for a row that turns out to
deserve different treatment, and gives no way to answer "is this page grandfathered" with a
SELECT. A boolean does all three. The operator check after applying 0019 is one query:
`select count(*) from smart_pages where status='published' and not entitlement_grandfathered`
must return 0.

**Why per page rather than per account.** Per account, grandfathering would quietly become
an unlimited free tier for everyone who signed up before the cutover. Per page, an existing
customer keeps exactly what they had and their *next* profile is a draft like everybody
else's.

**One asymmetry, found by a test rather than by reasoning:** the first implementation
computed `max(1, slots + grandfathered)`, which gave an account with one grandfathered page
and no identities a total allowance of one — so a customer who had been here since before
the change could not start a second profile at all, while someone signing up that morning
could. Grandfathered pages are now added **on top of** the floor rather than counted into
it. Being here first must never cost someone anything.

---

### D-024 — Segments are marketing packaging, not stored state
**Date:** 2026-09-02 · **Status:** Accepted · **Supersedes:** the segment half of D-018

**Context:** D-018 replaced plan tiers with `accounts.segment` (professional / business /
commercial) and hung `analytics`, `customBranding` and `teamManagement` off it. That is a
per-account plan wearing a different word, and it was read in two places including SQL.

**Decision:** segments are Individual / Business / Corporate, they live on the pricing page,
and they carry **no entitlements**. Nothing is stored on the account. `entitlementsFor()`
takes one argument: how many live identities the account holds.

**Why there was no third option.** With the free tier gone, exactly one axis remains — does
this account own a working device. A per-segment feature gate is not merely unwanted, it is
unimplementable without storing a segment, and storing one recreates what D-018 removed.

**The consequence, stated rather than buried:** every paying account can now hide the
"Powered by Hornbill TapTap" footer, where previously only Business and Commercial could.
That is free distribution given up on a product whose main channel is people sharing links.
It was chosen over the alternatives because the honest version of one paid tier is one paid
tier, and because selling a restriction we invented to fill three columns is the fabrication
§15 forbids. **If the distribution turns out to matter more than the consistency, the change
is one line in `ACTIVE_ENTITLEMENTS`.**

**The pricing teaser lost two claims** rather than carrying them forward: "Basic report"
against the cheaper column (untrue now that every paying account gets the full report) and
team management (still unbuilt, D-017). §15 rules out both.

**`accounts.segment` is left in place and unread.** Dropping a column in the same migration
that changes entitlement means a rollback loses data. It goes in a later cleanup once 0019
has proven itself, exactly as D-018 left `subscriptions` alone — and 0019 stops the signup
trigger writing `subscriptions(plan='free')`, which was the last live free-tier remnant.

---

### D-025 — Column-level grants on `nfc_tags`
**Date:** 2026-09-19 · **Status:** Accepted · **Builds on:** D-018, D-021 · **Found by:** the Sprint 8 audit

**Context:** `nfc_tags` has carried a table-wide UPDATE policy for `authenticated` since 0005
and was never given column-level grants. Every other table a signed-in user can write got that
treatment the moment it grew a write path — `accounts` in 0007, `leads` in 0012, `orders` in
0017, `smart_pages` and `quote_requests` in 0019. This one was missed, and it is the table that
decides what the product charges for.

**The exposure, stated plainly:** an RLS policy controls which ROWS a user may write, never
which COLUMNS, so `PATCH /rest/v1/nfc_tags?id=eq.<their own tag> {"term_end":"2099-01-01"}`
succeeded. `nfc_tags_update_own` verified only that the row stayed on the caller's account.
`account_live_identities` (`0019:78-90`) reads `status` and `term_end`, both writable, so one
request defeated renewal enforcement (D-018), the fourteen-day grace window, and the publish
slot count (D-022) together. There is no evidence anyone found it; the fix does not depend on
that.

**Decision:** `revoke insert, update, delete on public.nfc_tags from authenticated`, then
`grant update (label)` and nothing else. `label` is a name the owner chose for a card, read by
nobody but them, and no rule depends on its value. Repointing and switching a card off move into
`rebind_tag()` and `set_tag_status()`, SECURITY DEFINER, carrying the rules the application code
carried in TypeScript.

**Why this ships on its own rather than inside Sprint 8.** Sprint 8 adds `stock_state`,
`serial`, `batch_id` and `variant` to this same table. Every one of them would have been
customer-writable, and a customer who can write `stock_state` can take a card out of somebody
else's order. Fixing the grant first makes the sprint's new columns safe by construction rather
than by remembering.

**`replace_tag` is corrected in the same migration**, because it is the same hole reached from
the other side. 0010's version copied `smart_page_id` onto the replacement and nothing else — no
`kind`, no `term_start`, no `term_end`. A replacement card therefore landed with `term_end` NULL,
which `identity_is_live` (`0015:128`) treats as live unconditionally and forever, since failing
open on a missing timestamp was the right call for a backfill. Replacing a card converted a term
that expires into one that does not. It now carries the term it is continuing.

**What was deliberately NOT changed.** The row-level policies are correct; the row half was never
the problem, and rewriting them would be changing the wrong thing. `rebind_tag` still accepts a
disabled tag and re-enables it as a side effect, exactly as the Devices screen has always
behaved — a permissions fix is the wrong place to change what a button does. And which tags
`replace_tag` will accept is left alone here: with stock cards printing their own QR on the back,
accepting any unowned token becomes a way to collect a free card, but that is a product decision
and it belongs to D-027.

**Consequences:** `app/dashboard/devices/actions.ts` calls two RPCs where it wrote the table.
`lib/tag-write-enforcement.test.ts` asserts against the migration text in the
`publish-enforcement` style, including that no future migration re-grants `term_end`, `term_start`,
`status` or `account_id` — the test fails in CI rather than in production.

---

### D-026 — Cards are stock, not made to order
**Date:** 2026-09-19 · **Status:** Accepted · **Revises:** D-019's provisioning half

**Context:** every card was made to order: a customer paid, `provision_identities` drew an
unowned token from a pool, and somebody encoded that token onto a blank card. That works for one
customer and becomes chaos at ten. The supplier can print cards generically in bulk, each
carrying its own pre-minted token, a printed serial and a QR — which turns a two-week production
job into about two minutes of picking and packing.

**Decision:** the supplier prints generic stock and never prints anything customer-specific. A
customer is joined to a physical card **inside our system, by staff, at fulfilment**. Payment
mints a PLACEHOLDER identity; scanning a card moves that identity onto the plastic.

**Why a placeholder rather than waiting for the card.** D-022 established that entitlement is a
slot count precisely because identities exist weeks before hardware ships. A customer who pays
on Monday must be able to publish on Monday, not when a parcel arrives on Friday. The placeholder
is a real identity in every respect that matters — billable, publishable, renewable — and differs
only in that its token is never printed and never encoded, so `resolve_tag` refuses it.

**Why the pool draw had to go rather than be fixed.** With stock on a shelf, drawing a token at
payment binds a specific physical card, sitting in a drawer in Mombasa, to a customer who will be
posted a different one. There is no version of that which is correct; the concept of "the pool"
stopped existing the moment cards became objects with locations.

**The invariant, made executable.** `bind_order_unit` reads `account_live_identities` before and
after the move and raises if the number changed. A bind that quietly added a slot would let
somebody publish a page they have not paid for; one that quietly removed a slot would darken a
page printed on a shopfront. A comment cannot fail, so it is a check.

**Two axes, deliberately.** `nfc_tags.status` keeps exactly its 0005 meaning — it describes the
IDENTITY. `stock_state` describes the PLASTIC. A card can be `in_stock` owned by nobody; an
identity can be `assigned` with no plastic at all. This is the same separation D-019 made between
fulfilment and payment, for the same reason.

**Cancelling returns the card to stock** rather than disabling it. 0017's trigger was right when
"what the order provisioned" was a token nobody had touched; it would now destroy a printed,
encoded, locked object because somebody cancelled before it shipped.

**Consequences:** `provision_identities` is dropped and `provision_order` replaces it, absorbing
the unit creation, the `payment_tags` insert and the idempotency check into one transaction — a
crash between the mint and the link used to leave identities with no payment row, which breaks
renewals silently for a year. `/admin/mint` becomes `/admin/stock`. Fulfilment paths become
path-dependent in `lib/orders.ts`: a stock order is four stages, not ten.

---

### D-027 — Unowned cards cannot be self-claimed
**Date:** 2026-09-19 · **Status:** Accepted · **Revises:** D-009's claim flow

**Context:** D-009 designed the claim flow around "bulk-encode blank cards, sell, let customers
self-claim". That was safe while a token was a 32-character random string nobody could see. Stock
cards print their QR on the back, so the token is now visible to anyone who photographs a card in
a display case or picks one off a counter.

**Decision:** `claim_tag` refuses any tag with `account_id is null`, and `replace_tag` refuses any
token not already owned by the caller. A card is joined to its owner by staff at fulfilment and by
nobody else. `claim_tag` stops meaning "claim a card" and starts meaning "link a card I own".

**Why this closes a real hole and not a theoretical one.** The claimant needed only a published
page, which every paying customer has. And because `identity_is_live` treats a NULL `term_end` as
live unconditionally (0015, a deliberate fail-open for the backfill), the free card would have
stayed free permanently. Photograph, claim, done.

**What this costs, stated rather than buried:** card-first sales are now impossible. An agent
cannot hand someone a card at an event and have them activate it themselves. That is a real
channel being given up for now, and the way back is an **activation code printed separately from
the QR** — something you must physically possess the card to read, which a photograph of the back
does not give you. Until that exists, nobody self-claims anything.

**The unowned-card screen is warm, not a 404.** Whoever reaches it is holding a real card. Telling
them it does not exist would be both unhelpful and untrue, so it says the card has not been
activated yet and offers a link to buy one.

---

### D-028 — Delivery is priced at checkout
**Date:** 2026-09-19 · **Status:** Accepted · **Revises:** Sprint 7's collect-after-payment rule · **Amends:** D-018

**Context:** Sprint 7 decided to ask for product, quantity and M-Pesa number and nothing else,
because "every field before a payment is a place to abandon it". Delivery was free and arranged
afterwards. It is not free any more: a rider drop in Mombasa or Nairobi costs us nothing, and
anywhere else is a courier or a shuttle parcel.

**Decision:** one question moves in front of the payment — where is this going — because it
changes the amount. Everything else about delivery stays after it, and stays editable from the
order page until it ships.

**Why only the zone.** Sprint 7's reasoning has not changed; what changed is that the STK amount
cannot be computed without knowing the destination. Zones rather than towns because a town list
for Kenya is either wrong or enormous, and the only distinction that costs money is whether a
rider can reach it today. The customer's town is captured as free text alongside, because the
rider still has to find the place.

**The rate lives in the database, which is an exception to D-018.** `lib/pricing.ts` is otherwise
the single source of truth for money. Courier rates move on somebody else's schedule, and a price
that needs a deploy to change is a price that stays wrong for a week. It is still exactly ONE copy
of the number — `delivery_rates` is the source, `lib/pricing.ts` holds the arithmetic and no
figure of its own — and `deliveryFeeKes` has no hard-coded fallback, deliberately, so rates
failing to load is visible at checkout rather than quietly charging somebody nothing.

**Snapshotted onto the order.** `orders.delivery_fee_kes` records what was charged. Changing a
rate never rewrites what somebody already paid.

---

### D-029 — Premium is a custom front on a stock blank
**Date:** 2026-09-19 · **Status:** Accepted (partially built) · **Builds on:** D-026

**Decision:** a Premium card is the same stock card with its front left blank and printable. The
back is printed identically — QR, serial, "Tap or scan" — and we print the customer's name, title
and logo on the front in-house from their Tap Profile, on a fixed CR80 template, after they
approve a proof.

**Why it is a variant and not a product line.** It is kind `card` for billing (D-018): it renews
at the same price and counts as one identity. What differs is which blank comes off the shelf and
that the order walks the `custom` path instead of `stock`. Treating it as a separate product would
have meant a second pricing model and a second renewal rule for a piece of plastic.

**It sells before the proof flow is automated**, by decision. Staff produce the front by hand and
mark the unit approved in the console; 8c then automates a process that is already running rather
than inventing one. The alternative was hiding a product we can already make.

**The proof will freeze at approval.** `order_units` carries the snapshot columns from the start,
so a customer editing their profile after approving cannot change what gets printed — and cannot
discover the difference when the card arrives.

---

### D-030 — Dispatch carries a reference, and is refused without one
**Date:** 2026-09-20 · **Status:** Accepted · **Builds on:** D-019, D-020, D-028

**Context:** 0023 gave an order a dispatch method, a reference and a timestamp, and nothing wrote
them. "Dispatched" was one more button in the row of stage moves, which meant a parcel could leave
the building with no record of who was carrying it.

**Decision:** dispatch is not a stage move. It is a form that asks how the parcel is going and who
has it, and `advanceOrderAction` **refuses** a bare transition to `dispatched` so that no surface
can skip it. The board links to the order page rather than offering the move; the order page shows
the form.

**Why refuse it rather than hide the button.** The same reasoning D-020 used for the transition
rules: hiding a control is presentation, and presentation is not enforcement. A colleague with a
stale page, a second tab, or a replayed form post would otherwise dispatch an order with no
reference, and the fact is unrecoverable afterwards. Nobody can reconstruct which rider took a
parcel three days ago.

**"Dispatched" on its own cannot answer the only question that follows it.** The customer's
question after a parcel leaves is always "where is it". A rider's name and number, or a waybill,
is the difference between an answer and an apology, and the only moment it is knowable is while
somebody is standing over the parcel.

**The facts are recorded before the status moves.** `record_dispatch` writes `dispatched_at`, and
`dispatch_notification_target` returns nothing for an order that has not been dispatched. A crash
between the two therefore leaves an order staff can see has gone out and can announce again,
rather than an email about a parcel still on the bench.

**The email is idempotent and is not re-sent on a correction.** It claims
`notification_deliveries` before sending, exactly as `notifyNewLead` does, so a retry is a skip
rather than a second email. Correcting a waybill afterwards therefore does not re-notify, which is
the right way round: one email with a wrong digit prompts a phone call, two emails with different
numbers prompt a complaint.

---

### D-031 — A card is stock only once its chip is written, verified and locked
**Date:** 2026-09-20 · **Status:** Accepted · **Builds on:** D-026 · **Sprint:** 8b

**Context:** 8a gave cards a `received` state and an `in_stock` state and nothing that could
move between them. `receiveBatchAction` set `received`; the only code that ever produced
`in_stock` was the one-off LEGACY adoption in `0021`. A card minted through `/admin/stock`
could never become sellable, and the sprint doc's acceptance script said "set it by hand for
now".

**Decision:** encoding is that transition, and it is one atomic step: write one NDEF URL
record, read the chip back, compare, lock, and only then record the card as `in_stock` with
`encoded_at`, `locked_at` and `encoded_by`.

**The order of operations is the design, because the last step is irreversible.** Locking
first, or locking without reading back, turns a chip that took a mangled write into a
permanently dead card that looks perfectly fine until a customer taps it. There is no
recovery: the chip is read-only and the plastic is printed.

**The card identifies itself.** Staff scan the QR printed on its back or type its serial, and
we write that card's own token. Working down a list in serial order would be faster and
wrong, because blanks are physically indistinguishable except for the serial printed on them,
so "the next one" is not something anyone can pick up reliably.

**Encoding is refused anywhere but the live site.** `isProductionSiteUrl` allows exactly one
host over HTTPS: not localhost, not a preview deployment, not a staging subdomain that merely
ends with the right string. The server action re-checks it rather than trusting the page,
because the cost of being wrong is a drawer of cards nobody can fix.

**A failed lock is recorded as unlocked, not claimed as locked.** `makeReadOnly()` support is
uneven. A chip that works but stayed rewritable is a real state, and a shelf that cannot tell
which is which is worse than no record at all, so the batch list shows the count.

---

### D-032 — The first tap after dispatch closes the order
**Date:** 2026-09-20 · **Status:** Accepted · **Builds on:** D-019, D-030 · **Sprint:** 8b

**Context:** an order sat at `dispatched` until a staff member remembered to mark it
delivered, so "delivered" recorded somebody's memory rather than an event.

**Decision:** the first tap or card-QR scan of an allocated card, after its order has been
dispatched, sets `first_tap_at`, moves the order to `delivered` and emails the owner. It is
the best delivery confirmation available: the customer is holding the card and it works. No
courier receipt proves the chip survived the journey.

**Taps before dispatch do not count.** Staff test cards, and a test tap in the workshop must
never mark a parcel delivered that is still on the bench.

**Service-role only, from inside `after()`.** `log_event` is granted to `anon` because logging
a view is harmless; closing an order is not, so `record_first_tap` is unreachable from a
browser and is called with the admin client after the redirect has already gone out. The tap
path is the hottest in the product — somebody is standing in front of a customer with a phone
against a card — and an email provider having a slow afternoon must not be something either
of them can feel.

**Idempotent by construction rather than by checking first.** The UPDATE carries
`first_tap_at is null`, so the second tap updates nothing and the caller is told there is
nothing to announce. That is what makes it safe to call on EVERY tap, which in turn keeps the
decision off the hot path: deciding in the application would mean an extra read to answer a
question that is almost always "no".

**The audit trail says the customer did it.** The status trigger stamps `changed_by` from
`auth.uid()`, which is null here, and the event is noted "First tap" rather than naming
whichever staff member happened to be adjacent.

---

_Add new decisions above this line as `D-00N`, and mirror the one-liner into
`PROJECT.md`._
