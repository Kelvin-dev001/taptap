# Sprint 1 — Foundations (tracking)

**Started:** 2026-07-22 · **Status:** In progress
**Goal:** prove the core loop end-to-end — a tappable slug that redirects, backed by
auth, tenancy, and analytics capture.

## Acceptance criteria → status

| Criterion | Status | Notes |
|-----------|--------|-------|
| User can sign up, reserve a slug, set a redirect target | ✅ code complete | `/login`, `/dashboard`, `createProfileAction`; needs live Supabase to exercise |
| Opening `/<slug>` 302-redirects to the target | ✅ code complete | `app/[slug]/route.ts` (edge runtime) |
| Redirect p95 < 200ms, no cold-start | ⏳ to measure | edge runtime chosen; measure after deploy; async-logging optimization deferred to Sprint 2 |
| RLS prevents cross-account access | ✅ policies written | `0001_init.sql`; verify on live project |
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

## Definition of done

All acceptance criteria verified on the deployed environment with the subdomain live,
plus a green `npm run build`, `npm run typecheck`, and `npm run test`. Then close the
sprint with the standard summary and request approval for Sprint 2 (Smart Profile
engine — page mode, editor, themes, vCard, QR).
