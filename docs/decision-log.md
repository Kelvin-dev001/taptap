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

_Add new decisions above this line as `D-00N`, and mirror the one-liner into
`PROJECT.md`._
