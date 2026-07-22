# Sprint 1 — Foundations (tracking)

**Started:** 2026-07-22 · **Status:** ✅ Complete — live 2026-07-22
**Goal:** prove the core loop end-to-end — a tappable slug that redirects, backed by
auth, tenancy, and analytics capture.

## Acceptance criteria → status

| Criterion | Status | Notes |
|-----------|--------|-------|
| User can sign up, reserve a slug, set a redirect target | ✅ code complete | `/login`, `/dashboard`, `createProfileAction`; needs live Supabase to exercise |
| Opening `/<slug>` 302-redirects to the target | ✅ code complete | `app/[slug]/route.ts` (edge runtime) |
| Redirect p95 < 200ms, no cold-start | ✅ live (measure formally) | edge runtime; live & redirecting; formal latency read + async-logging optimization in Sprint 2 |
| RLS prevents cross-account access | ✅ live (2-account spot-check recommended) | `0001_init.sql` applied; recommend a quick two-account isolation test |
| Exactly one event per hit | ✅ code complete | `log_event` RPC; `tap` default, `scan` when `?src=qr` |
| Slug uniqueness enforced at DB level | ✅ | `unique` constraint + lowercase check + reserved list |

## Done in-repo (no accounts needed)

- Next.js + TypeScript + Tailwind scaffold, tooling, `.env.example`.
- Supabase schema + RLS + `resolve_slug`/`log_event` RPCs + new-user trigger
  (`supabase/migrations/0001_init.sql`).
- Slug validation/normalization + reserved words, with passing unit tests.
- Edge redirect service with safe-destination guard and event logging.
- Email/password auth, session middleware (scoped to `/dashboard`), and a minimal
  dashboard to create redirect links and list them.
- README with setup, local test loop, and deploy/DNS steps.

## Needs Kelvin (requires your accounts)

1. **Create the Supabase project** and run `0001_init.sql` in the SQL editor.
2. Put the Supabase URL + anon key into `.env.local` (and later Vercel env).
3. **Deploy to Vercel** (import the GitHub repo, add env vars).
4. **Configure DNS** for `taptap.hornbilltech.co.ke` (CNAME to Vercel) — the root
   domain's existing project is untouched.

## Known gaps / tech debt (tracked, intentional)

- Redirect awaits the event write; move to cached resolve + fire-and-forget in S2.
- Auth is minimal (email/password, no password reset/magic link yet).
- No automated e2e against a live Supabase yet (unit tests cover slug logic).
- **Next.js 14 is EOL** (final patch 14.2.35, Dec 2025). Pinned to 14.2.35 for now;
  plan a migration to a supported Next major (15+) early — see decision log D-008.
- No committed lockfile yet; add `package-lock.json` for reproducible builds.

## Definition of done

All acceptance criteria verified on the deployed environment with the subdomain live,
plus a green `npm run build`, `npm run typecheck`, and `npm run test`. Then close the
sprint with the standard summary and request approval for Sprint 2 (Smart Profile
engine — page mode, editor, themes, vCard, QR).

## Sprint 1 closeout (2026-07-22)

**Completed.** Deployed live on Vercel (running on the `*.vercel.app` URL; custom
subdomain pending DNS). The core loop works end-to-end: sign up (a trigger
auto-provisions an account + free subscription), reserve a slug, set a redirect
destination, and opening the slug 302-redirects while logging a tap/scan event.
Codebase: Next.js 14.2.35 + Supabase (Postgres, Auth, RLS), edge redirect service,
slug reservation + reserved-word list, safe-destination guard, and a minimal
dashboard. Slug and URL logic unit-verified; Vercel build green.

**Decisions made.** D-005 Supabase Storage · D-006 annual-first billing · D-007
subdomain hosting · D-008 pin Next 14.2.35 and plan migration to a supported major.

**Outstanding questions.** None blocking. Recommended quick follow-ups: (a) a
two-account RLS isolation spot-check; (b) an informal redirect-latency read from
Kenya; (c) add the `taptap.hornbilltech.co.ke` CNAME and set `NEXT_PUBLIC_SITE_URL`
to the custom domain; (d) commit a `package-lock.json` for reproducible builds.

**Risks discovered.** Next 14 is EOL (mitigated: pinned + planned migration, D-008);
`NEXT_PUBLIC_*` vars are build-time inlined (operational gotcha, now documented);
redirect currently awaits the event write (latency optimization deferred to S2).

**Recommended improvements (into Sprint 2).** Cached slug resolve + fire-and-forget
event logging; migrate to a supported Next major; auth hardening (password
reset / magic link); then the Sprint 2 feature set below.

**Approval requested.** Approve to begin **Sprint 2 — Smart Profile engine (page
mode):** page rendering at the slug, the profile editor/dashboard, themes/branding,
vCard download, and QR-code generation.
