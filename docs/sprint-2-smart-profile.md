# Sprint 2 — Smart Profile Engine (Page Mode) — Plan

**Status:** Proposed — awaiting approval to build · **Est:** ~2.5 weeks (roadmap weeks 3–5)
**Goal:** turn the slug from a redirect-only endpoint into a real, rendered **smart
page** — a digital business card / multi-action landing page — plus the dashboard
editor, themes, vCard, and QR generation. This is where TapTap starts looking like a
product.

> Planning mode: this document is for approval. No build until you sign off.

## Objectives

1. Migrate off end-of-life Next 14 to a supported major (Step 0).
2. Render **page mode** publicly at `/<slug>` (blocks, branding), keeping redirect
   mode fast.
3. Ship a **profile editor** to build/reorder blocks, set branding, and pick a theme.
4. Add **vCard download** and **QR-code generation**.
5. Wire **Supabase Storage** for logos/avatars (D-005).

## Step 0 — Next major migration (do first)

Bounded cleanup before feature work, while the codebase is tiny (per D-008).

- Bump `next`, `react`, `react-dom` to the current Active LTS (**Next 16.2 / React 19**;
  Next 15 is only maintenance LTS until Oct 2026).
- Handle breaking changes: `cookies()` becomes async (`lib/supabase/server.ts` →
  async client; update callers to `await`); dynamic route `params` become a Promise
  (`app/[slug]` → `await params`); `useFormState` → `useActionState`
  (`create-profile-form.tsx`).
- **Exit gate:** green Vercel build + the Sprint 1 loop (signup → slug → redirect →
  event) still works before starting features. Commit a `package-lock.json`.

## Deliverables

- **Public page mode:** `/<slug>` renders a smart page when `mode = 'page'` (avatar/
  logo, title, bio, and ordered action blocks); still 302/redirects when
  `mode = 'redirect'`. A `view` event is logged on page render.
- **Block types (v1 set):** save-contact (vCard), call, WhatsApp, email, website,
  socials (IG/FB/TikTok/LinkedIn/X), directions, Google review, custom link.
- **Editor:** dashboard UI to switch mode, add/edit/remove/reorder blocks, set title/
  bio, upload a logo/avatar, and choose a theme.
- **Themes/branding:** 3–4 preset themes + a custom brand color; stored per page.
- **vCard:** one-tap `.vcf` download from a page; logs a `download` event.
- **QR generation:** downloadable QR (PNG/SVG) for the slug (encoding `?src=qr`),
  from the dashboard.
- **Storage:** a Supabase Storage bucket + policies for page assets.
- **Perf improvement carried from S1:** cached slug resolve + fire-and-forget event
  logging on the redirect path.

## Acceptance criteria

- A `page`-mode slug renders on mid-tier Android with Lighthouse performance ≥ 90 and
  loads fast on slow connections (tight JS/image budget).
- Editing blocks/theme in the dashboard reflects on the public page immediately.
- vCard downloads and imports correctly on iOS Safari and Android Chrome.
- A generated QR resolves to the slug and logs a `scan` (via `?src=qr`).
- Redirect mode still works and now logs asynchronously (no added user-facing latency).
- Uploaded logos are readable publicly but a user can only write to their own account's
  assets (verified).

## Architecture

- Replace `app/[slug]/route.ts` with `app/[slug]/page.tsx` (server component, edge):
  resolve once → `redirect()` for redirect mode, render for page mode.
- New SECURITY DEFINER RPC `get_public_page(slug)` returns title/bio/config/theme +
  ordered links for active `page`-mode slugs (keeps tenant tables unexposed to anon).
- Event logging: redirect mode logs server-side then redirects; page-mode `view` and
  block `click`/`download` fire via a small client beacon to a lightweight
  `/api/track` route (avoids RSC double-execution and keeps render pure).
- Editor uses server actions + the existing `links` table and `smart_pages.config` /
  `theme` jsonb.

## Database considerations

- Migration `0002`: add `get_public_page` RPC; extend `events.type` check to include
  `download`; create Storage bucket `page-assets` + policies.
- Keep flexible content (bio, block config, theme) in jsonb — no schema churn as block
  types grow (the design that makes "add products without rearchitecting" true).
- Reuse existing `links` and `qr_codes` tables; index `links(smart_page_id, sort_order)`.

## UI considerations

- Mobile-first public page; large tap targets; legible contrast; screen-reader labels.
- Editor: simple, low-friction (target: build a card in < 5 min); drag-or-arrow reorder.
- Swahili-ready copy structure (English first).

## Security

- Storage policies: owners write only to their account's folder; public read for
  published assets only.
- Public rendering exposes only fields returned by `get_public_page`.
- Continue open-redirect guard; validate/normalize all block values (URLs, phone,
  email) on save.
- Rate-limit `/api/track` and vCard/QR endpoints.

## Performance

- Cached slug resolve + fire-and-forget logging (removes the S1 await-on-redirect).
- Optimized images (next/image or Supabase transform); minimal client JS on public
  pages; strict performance budget for Kenyan mobile data.

## Scalability

- jsonb config + append-only events; QR generated on demand and cacheable; stateless
  rendering suitable for edge.

## Testing strategy

- Unit: vCard generation, block/URL validation, theme application, QR payload.
- Integration: `get_public_page` returns correct data and nothing for inactive/other
  accounts; Storage write isolation.
- E2E: signup → build a page → view it → tap a block (event logged) → download vCard →
  generate QR; redirect mode still 302s.
- Regression: Sprint 1 loop after the Next migration.

## Documentation

- Update `README.md` (new env/bucket setup, block types), `PROJECT.md` phase, and this
  file's closeout. Record the Next-major migration completion under D-008.

## Potential risks

- Next 15 / React 19 migration surface (mitigated: Step 0 gate before features).
- RSC event double-fire (mitigated: client beacon for page-mode events).
- Storage misconfiguration exposing files (mitigated: explicit policies + isolation test).
- QR/library bundle bloat (mitigated: server-side generation, keep public JS lean).
- Block-type scope creep (mitigated: fixed v1 block set above).

## Technical debt review (end of sprint)

Confirm the unified `[slug]` entry is clean, no N+1 on links, lockfile committed,
migration reproducible, and no shortcuts left undocumented before Sprint 3 (Analytics
& leads).
