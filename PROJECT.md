# Hornbill TapTap — Project Charter (Source of Truth)

> **Read this first.** This file is the living source of truth for the project.
> When starting a new session, read this file and `docs/decision-log.md` instead of
> re-reading the original master-prompt PDF. Update this file whenever a major
> decision changes.

**Last updated:** 2026-08-15
**Current phase:** **UI/UX transformation — Sprint UI-5 complete** (Smart Business Cards,
2026-08-15); awaiting approval for UI-6 (NFC + QR). Build sprints 0–5 are code-complete —
MVP feature-complete, with Sprint 5 hardware still pending physical verification.
⚠ Migrations `0005`, `0007` and `0009` are written but **not yet run** in Supabase
(`0008` is applied).
**Target:** MVP live / first paying customers within ~3 months (by late October 2026)
**Company:** Hornbill — an existing company that owns `hornbilltech.co.ke`. The root
domain already hosts a separate project, so TapTap will run on the
`taptap.hornbilltech.co.ke` subdomain (DNS/subdomain **not yet configured** — set up in Sprint 1)

---

## What we are building

Hornbill TapTap is a **Smart Digital Identity & Customer Engagement Platform** for
Africa, starting in Kenya. NFC and QR are just *interaction methods* — the product
is the software.

The whole platform reduces to **one engine**: a business configures a permanent
slug (e.g. `https://taptap.hornbilltech.co.ke/business-name`) that any NFC tag or QR
code points to. That slug renders as either:

- a **rich smart page** (digital business card / multi-action landing page), or
- a **single-destination redirect** (Google review, WhatsApp, Instagram, TikTok
  follow, website, phone, directions, payment, or any custom action).

Owners change destinations from a dashboard; the physical NFC/QR is **never
reprogrammed**. Every other "product" in the original brief (smart menus, property
displays, review stands, catalogues, employee cards, etc.) is a **template on this
same engine** and is deferred until after product-market fit.

## Vision

Become Africa's leading offline-to-online engagement platform. Wedge in Kenya,
expand across East Africa, then the continent.

## Confirmed decisions (see `docs/decision-log.md` for full context)

| # | Decision |
|---|----------|
| D-001 | **MVP wedge:** one-engine Smart Profile — digital card / multi-action page / single redirect |
| D-002 | **Build posture:** beachhead-first (clean seams, build only what the wedge needs) |
| D-003 | **Architecture:** Next.js + Supabase only. No standalone Express. Dedicated edge-cached redirect service. |
| D-004 | **Resourcing:** solo, bootstrapped — optimize for speed, low cost, managed services, minimal ops |
| D-005 | **Storage:** Supabase Storage (not Cloudinary) in v1 — one fewer vendor |
| D-006 | **Billing:** annual-first via M-Pesa STK push / Paystack; defer M-Pesa Ratiba recurring |
| D-007 | **Domain:** run on `taptap.hornbilltech.co.ke` subdomain (root hosts another project); configure in Sprint 1 |
| D-008 | **Framework:** pin Next 16.2 (Active LTS) + React 19; migrated off EOL Next 14 |
| D-009 | **NFC identity:** permanent token URL `/t/<token>` per card (never re-encode); slugs kept for sharing |
| D-010 | **Secrets:** Supabase publishable/secret keys; `.env.example` holds placeholders only (real values in `.env.local` + Vercel) |
| D-011 | **Design system:** vendored Radix + CVA in `components/ui/` — we own the files, not a component framework |
| D-012 | **Brand colour:** `#F97316` for text-free fills; `#C2560A` for white-label buttons and orange text (white on `#F97316` is 2.80:1 — fails AA) |
| D-013 | **Routing:** app routes nest under `/dashboard/*`; `/[slug]` root catch-all means new nav names must be reserved pre-launch |
| D-014 | **Typography:** Inter via `next/font`, self-hosted |

## MVP scope (one line)

Smart Profile engine + permanent slug/redirect + NFC/QR provisioning + owner
dashboard + tap/scan/click analytics + vCard + subscription billing. **Everything
else is out of v1.**

## Tech stack (MVP)

- **Frontend/App:** Next.js (App Router) + Tailwind CSS on **Vercel**
- **Backend:** Next.js route handlers + **Supabase** (Postgres, Auth, Row-Level Security, Edge Functions)
- **Storage:** Supabase Storage (Cloudinary deferred — see D-005)
- **Redirect service:** edge-cached route (must not cold-start)
- **Payments:** M-Pesa (Daraja) + card rail (Paystack/Flutterwave); billing model TBD (D-006)

## How the docs fit together

- `PROJECT.md` — this charter (read first)
- `docs/sprint-0-blueprint.md` — approval-ready blueprint + detailed Sprint 1 plan
- `docs/sprint-1-foundations.md` — Sprint 1 tracking + closeout (complete)
- `docs/sprint-2-smart-profile.md` — Sprint 2 (page mode) — complete
- `docs/sprint-3-analytics-leads.md` — Sprint 3 (analytics & leads) — complete
- `docs/sprint-4-billing.md` — Sprint 4 (billing) — complete
- `docs/sprint-5-hardware-compliance.md` — Sprint 5 (hardware & compliance) — built
- `docs/sprint-ui-0-audit.md` — UI/UX audit & design-system architecture (UI-0) — complete
- `docs/sprint-ui-1-design-system.md` — design-system foundation (UI-1) — complete
- `docs/sprint-ui-2-app-shell.md` — application shell & information architecture (UI-2) — complete
- `docs/sprint-ui-3-dashboard.md` — dashboard & actionable metrics (UI-3) — complete
- `docs/sprint-ui-4-builder.md` — Tap Profile builder, live preview & publish (UI-4) — complete
- `docs/sprint-ui-5-smart-cards.md` — Smart Business Cards as a template facet (UI-5) — complete
- `docs/reference/` — supplied UI reference mockup (visual direction, not a pixel spec)
- `docs/sprint-0-discovery.md` — full discovery: PRD, data model, security, pricing, GTM, risks
- `docs/decision-log.md` — running ADR-lite record of decisions
- `CLAUDE.md` — operating instructions for the AI engineering partner

## Working rules (from the master prompt)

Planning mode only until Sprint 0 is approved. No production code, no scaffolding.
Challenge assumptions, flag technical debt early, design for maintainability. End
each sprint with a summary, open questions, decisions, risks, and a request for
approval before proceeding.
