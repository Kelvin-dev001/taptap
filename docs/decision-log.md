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

---

_Add new decisions above this line as `D-00N`, and mirror the one-liner into
`PROJECT.md`._
