# Hornbill TapTap — Project Charter (Source of Truth)

> **Read this first.** This file is the living source of truth for the project.
> When starting a new session, read this file and `docs/decision-log.md` instead of
> re-reading the original master-prompt PDF. Update this file whenever a major
> decision changes.

**Last updated:** 2026-07-22
**Current phase:** Sprint 2 — Smart Profile engine ✅ complete & accepted (2026-07-22). Next: Sprint 3 (Analytics & leads). Sprints 0–1 complete.
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
- `docs/sprint-2-smart-profile.md` — Sprint 2 plan (page mode) — proposed
- `docs/sprint-0-discovery.md` — full discovery: PRD, data model, security, pricing, GTM, risks
- `docs/decision-log.md` — running ADR-lite record of decisions

## Working rules (from the master prompt)

Planning mode only until Sprint 0 is approved. No production code, no scaffolding.
Challenge assumptions, flag technical debt early, design for maintainability. End
each sprint with a summary, open questions, decisions, risks, and a request for
approval before proceeding.
