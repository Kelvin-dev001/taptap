# Hornbill TapTap — Sprint 0 Blueprint (Approval-Ready)

**Prepared:** 2026-07-22 · **Phase:** End of Sprint 0 (Discovery & Planning)
**Decision requested:** Approve this blueprint to begin **Sprint 1 — Foundations**.

This is the consolidated, approval-ready plan. Full working detail lives in
`docs/sprint-0-discovery.md`; decisions in `docs/decision-log.md`; the one-line
charter in `PROJECT.md`.

---

## 1. Executive summary

Hornbill TapTap is a **Smart Digital Identity & Customer Engagement Platform** for
Africa, starting in Kenya. A business owns a permanent link (`taptap.hornbilltech.co.ke/
their-name`) that any NFC tag or QR code points to. That link renders as a digital
business card / multi-action page **or** redirects to a single destination (Google
review, WhatsApp, socials, website, booking, payment). Owners change destinations from
a dashboard; the hardware is never reprogrammed.

The strategic decision of Sprint 0: **this is one configurable engine, not thirteen
products.** That collapses an 18-month roadmap into a buildable MVP a solo founder can
ship in ~12 weeks. Hardware (cards/stands) is the customer-acquisition hook; the
recurring software subscription is the business.

**Target:** a payable, tappable MVP in the hands of a first customer cohort **by late
October 2026**.

## 2. Positioning & moat

We are not selling NFC cards; competitors (Popl, Blinq, HiHello, local card sellers)
do that. We sell a **recurring engagement platform** whose defensibility comes from:

- **M-Pesa-native billing and payments** — priced in KES, paid how Kenyans actually
  pay.
- **Local-first actions** — WhatsApp, Google reviews, directions, M-Pesa, built in.
- **One engine, many templates** — a single account can run a card today and a review
  stand or smart menu tomorrow, with unified analytics.
- **Analytics depth** — turning every tap into actionable business intelligence.
- **Local presence, support, and trust** under an existing Kenyan company (Hornbill).

## 3. The core insight — one engine

A permanent slug → a `mode` (`page` | `redirect`) → a flexible `config` (jsonb) →
event capture on every interaction. New "products" later are **templates and block
types on this engine**, needing no core rearchitecture. This is what makes the vision
("add new NFC products without changing core architecture") literally true.

## 4. Beachhead users (personas)

**Professional / Sales rep ("Sam").** Consultant, realtor, or field sales. Wants a
digital card that saves his contact instantly and pushes socials/portfolio/WhatsApp.
Every tap markets the product for us. Will pay for custom branding, lead capture, and
analytics.

**SME owner ("Amina").** Runs a café, salon, or clinic. Wants more Google reviews and
WhatsApp chats via a counter card or stand. Low tech tolerance, price-sensitive.
Values a dead-simple setup and a clear "more reviews / more customers" outcome.

_Deferred (expansion):_ corporate/team buyers, hospitality (menus), real estate,
retail, events, institutions.

## 5. Success metrics

**North Star:** weekly active engagements (taps + scans + clicks) on live profiles —
the leading indicator that we deliver real value.

**Business:** paying accounts and MRR. **Funnel:** signup → published profile → first
tap → paid conversion → month-2 retention. **Product/ops:** time-to-first-published-
profile, redirect p95 latency, redirect uptime.

_3-month targets to set together (illustrative):_ first paying cohort of ~20–50
accounts, an initial hardware batch sold, and a measured funnel we can optimize.

## 6. MVP definition

**In:** owner auth; create/edit a Smart Profile (slug, page/redirect mode, appearance,
content); page blocks (contact, save-contact/vCard, WhatsApp, call, email, website,
socials, directions, Google review, custom buttons); redirect mode; live destination
edits without touching hardware; QR generation + NFC tag association/claim; analytics
(taps/scans/views/clicks, device, day/time, coarse location where consented); optional
lead-capture block; subscription billing (annual-first via M-Pesa STK push / Paystack).

**Out (deferred, not cancelled):** teams/branches/RBAC, white-label & custom domains,
agency/reseller plans, enterprise SSO, most AI features, all non-card/non-redirect
templates, predictive analytics, native mobile app.

## 7. Key flows

**Customer tap/scan:** tap NFC or scan QR → hit permanent slug → edge resolves →
render page or 302 redirect in <200ms → event captured async. No app install; QR
fallback everywhere.

**Owner onboarding:** sign up → reserve slug → choose mode → add destinations/branding
→ publish → (optionally) register purchased NFC card → view analytics → subscribe.

## 8. System architecture

- **Next.js (App Router) + Tailwind on Vercel** — dashboard, public pages, API route
  handlers.
- **Supabase** — Postgres, Auth, Row-Level Security, Storage (images/logos/vCards).
- **Edge-cached redirect service** — resolves slug→destination with minimal DB
  dependency; must not cold-start; fires analytics asynchronously.
- **Payments** — Daraja (M-Pesa STK push) + Paystack card webhooks updating
  subscriptions.
- **No standalone Express** (D-003) — one deploy surface, one auth model.

See `docs/sprint-0-discovery.md` §6 for the full ERD and §9 for architecture detail.

## 9. Data & tenancy

Single Postgres DB, multi-tenant by `account_id`, isolated with **Row-Level Security**.
Core tables: `accounts`, `users`, `smart_pages` (slug, mode, jsonb config), `links`,
`nfc_tags`, `qr_codes`, `events` (append-only), `leads`, `plans`/`subscriptions`.
Flexible content in jsonb avoids migrations as templates grow. Redirect path is public
and exposes only what the owner published.

## 10. Business model & pricing (draft — validate)

Recurring subscription is the business; hardware is CAC. Draft tiers (KES, billed
annually-first): **Free** (1 profile, TapTap branding), **Starter ~500/mo or
5,000/yr** (custom branding, vCard, no branding), **Pro ~1,500/mo or 15,000/yr**
(multiple profiles, lead capture, advanced analytics), **Business ~4,000/mo** (teams,
later). Hardware one-off: card ~KES 1,500–3,500; stand ~KES 5,000–10,000. All figures
to validate with the market.

## 11. Go-to-market (lean, solo)

Land professionals/sales reps with the digital card (directly reachable, viral by
design) and nearby SMEs with single-redirect review/social cards and counter stands.
Sell the hardware once; monetize the software recurringly. Free-tier "Powered by
TapTap" drives exposure; add referrals and case studies after the first cohort.

## 12. Compliance & legal

- **Kenya Data Protection Act 2019** — register with the ODPC; publish a privacy
  policy; capture consent for lead forms; support access/deletion.
- **Google review policy** — no review gating; solicit reviews neutrally.
- **Payments** — follow Daraja/card-provider rules; store no card data.
- Global (later) — GDPR-style obligations on expansion.

## 13. Top risks

Scope creep (mitigated by the one-engine MVP contract); redirect downtime in front of
a live customer (edge cache, async analytics, monitoring); solo-founder bandwidth
(ruthless scope, managed services); DPA non-compliance and review-gating (handled
before launch); hardware COGS/logistics (small batches, treat as CAC). Full register:
`docs/sprint-0-discovery.md` §13.

## 14. Roadmap (~12 weeks)

| Weeks | Sprint | Focus |
|-------|--------|-------|
| 1–2 | 1 — Foundations | Repo/CI, Supabase schema + RLS, Auth, slug reservation, edge redirect route |
| 3–5 | 2 — Smart Profile engine | Page + redirect modes, dashboard editor, themes, vCard, QR generation |
| 6–7 | 3 — Analytics & leads | Event capture + analytics dashboard, lead-capture block |
| 8–9 | 4 — Billing | Plans/subscriptions, M-Pesa STK push + Paystack, plan gating |
| 10–11 | 5 — Hardware & compliance | NFC provisioning/claim, hardware pilot, performance, privacy/consent, ODPC |
| 12 | Beta | Onboard first customers, iterate |

## 15. Environment routing

- **Cowork (here):** planning, docs, decision log, research, keeping the source of
  truth current, daily standup.
- **Claude Code:** implementation from Sprint 1 on — scaffolding, coding, tests,
  deploy config.
- **Claude Chat:** quick one-off questions.

---

## 16. Sprint 1 plan — Foundations (proposed, ~2 weeks)

**Objective:** stand up the skeleton the whole platform hangs on and prove the core
loop end-to-end — a real, tappable slug that redirects, backed by auth and tenancy.

**Deliverables**

- Git repo + basic CI; Next.js app deployed to Vercel; `taptap.hornbilltech.co.ke`
  subdomain + SSL wired to the app.
- Supabase project with schema for `accounts`, `users`, `smart_pages`, `links`,
  `events`, and a `subscriptions` stub; RLS policies enabled.
- Auth flow (sign up / log in) via Supabase Auth.
- Create account → create first Smart Profile in **redirect mode** → reserve a unique
  slug (with reserved-word list and collision handling).
- **Edge redirect route**: `GET /<slug>` resolves slug→destination and 302s, writing
  exactly one `events` row asynchronously.

**Acceptance criteria**

- A new user can sign up, reserve a slug, set a redirect target, and opening
  `taptap.hornbilltech.co.ke/<slug>` redirects to that target with **p95 < 200ms from
  Kenya** and no cold-start stall.
- RLS provably prevents one account from reading/altering another’s rows.
- Each redirect hit produces exactly one analytics event; slug uniqueness enforced at
  the DB level.

**Architecture / DB / UI / Security / Performance / Scalability**

Next.js App Router on Vercel; edge runtime for the redirect; Supabase Postgres/Auth.
DB: slug unique constraint, indexes on `events(smart_page_id, ts)`, RLS on all
tenant rows. UI: minimal mobile-first dashboard, tight performance budget. Security:
RLS + auth, **open-redirect prevention** (validate/normalize targets), rate limiting
on redirect + any public endpoint, secret management. Performance: cache slug→target
at the edge, async event writes. Scalability: stateless app, append-only events;
defer partitioning until volume warrants.

**Testing strategy:** unit tests for slug validation and the redirect resolver;
integration test for auth + RLS isolation; a redirect latency check; a happy-path e2e
(signup → reserve slug → set target → tap → event recorded).

**Documentation:** update `PROJECT.md` and `decision-log.md`; add repo README/setup;
record any new decisions as ADRs.

**Potential risks:** DNS/subdomain + SSL setup friction; edge cold-start on the
redirect; scope creep into page-mode before the redirect loop is solid. **Technical
debt review** at sprint end before proceeding.

**Out of Sprint 1:** page-mode rendering, themes, QR/NFC provisioning, analytics
dashboard, billing — these are Sprints 2–4.

---

## 17. Sprint 0 closeout

**Completed:** business & product understanding; the one-engine reframe; MVP scope
(in/out); data model + ERD; tenancy/security model; architecture; pricing draft; GTM;
compliance plan; risk register; 12-week roadmap; decisions D-001–D-006 accepted;
timeline and company context confirmed; daily standup scheduled; living docs + memory
established.

**Decisions made:** D-001 one-engine MVP · D-002 beachhead-first · D-003 Next.js +
Supabase only · D-004 solo/bootstrapped posture · D-005 Supabase Storage · D-006
annual-first billing (defer Ratiba).

**Risks discovered:** see §13 / discovery §13 — scope creep, redirect reliability,
recurring-billing complexity, founder bandwidth, DPA & review-gating compliance,
hardware logistics.

**Outstanding (non-blocking):** warm-prospect list; rough budget ceiling; market
validation of pricing.

**Recommended improvements already folded in:** collapse products into one engine;
drop standalone Express; drop Cloudinary; annual-first billing; treat the redirect
service as a first-class edge component.

**Approval requested:** if you approve this blueprint, we begin **Sprint 1 —
Foundations** in Claude Code. Reply with approval (or changes), and confirm the
`taptap.hornbilltech.co.ke` DNS is yours to configure so we can wire the subdomain early.
