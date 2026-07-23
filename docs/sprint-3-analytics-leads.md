# Sprint 3 — Analytics & Leads — Plan

**Status:** ✅ Complete — accepted 2026-07-22 · **Est:** ~2 weeks (roadmap weeks 6–7)
**Goal:** turn the `events` we already capture into an owner-facing **analytics
dashboard**, enrich events with device/OS/country, and add **lead capture** (a public
form → the owner's leads list + CSV export).

> Planning mode: this document is for approval. No build until you sign off.

## Objectives

1. Enrich events with device, OS, and country so analytics are meaningful.
2. Give owners an analytics dashboard: account overview + per-page detail.
3. Add lead capture: a public form on enabled pages, owner leads list, CSV export.
4. Create the `leads` table correctly (RLS on from day one).

## Deliverables

- **Event enrichment:** parse the user-agent → device (mobile/tablet/desktop) + OS;
  read country from Vercel geo headers (`x-vercel-ip-country`). Populate these on both
  the redirect path (`app/[slug]/page.tsx`) and the `/api/track` beacon via `log_event`.
- **Analytics RPCs** (SECURITY DEFINER, scoped to the caller's account via `auth.uid()`):
  `get_account_overview(p_days)` — totals by event type across the account; and
  `get_page_analytics(p_page_id, p_days)` — daily time series + breakdowns by type,
  device/OS, and top-clicked blocks.
- **Dashboard UI:** summary cards + a simple time-series on `/dashboard`, and a
  per-page view at `/dashboard/[id]/analytics` (charts + tables). Lightweight,
  dependency-free SVG/CSS charts to keep the bundle lean.
- **Lead capture:** migration `0003` creates the `leads` table; a page-level
  "Collect leads" toggle + field/label config in the editor; a public lead form on
  enabled pages; submissions via a `submit_lead` RPC; owner leads list at
  `/dashboard/[id]/leads` with **CSV export**.

## Acceptance criteria

- An owner sees accurate counts (taps/scans/views/clicks/downloads) for their pages,
  broken down by day and device — and sees **only their own** data (a second account
  sees nothing of the first).
- New events carry device/OS (and country on Vercel; "unknown" locally).
- A visitor can submit a lead on an enabled page; it appears in the owner's leads list
  and CSV export. Anonymous users cannot read leads or any account's rows.

## Architecture

- **UA parsing:** small `lib/ua.ts` helper (no heavy dependency) → `{ device, os }`,
  with unit tests.
- **Geo:** Vercel edge/server geo header (`x-vercel-ip-country`); null in local dev.
- **Aggregation:** done in SQL via SECURITY DEFINER RPCs that filter to
  `account_id in (select account_id from public.profiles where id = auth.uid())` — never
  trust a client-supplied account id.
- **Leads write path:** anon calls `submit_lead` RPC (like `log_event`) — the `leads`
  table itself is never exposed to anon.

## Database considerations (migration 0003)

- `create table public.leads (id, smart_page_id fk, name, phone, email, meta jsonb,
  created_at)` — **RLS enabled**; owner-select policy via join to `smart_pages` →
  account; **no anon policy** (writes go through the RPC). Index `(smart_page_id,
  created_at)`.
- `submit_lead(p_page_id, p_name, p_phone, p_email, p_meta)` SECURITY DEFINER insert;
  granted to anon + authenticated; validates the page is active.
- Analytics RPCs return `jsonb`; date-bounded; rely on the existing
  `events(smart_page_id, ts)` index.
- Optionally add a `lead` event type for funnel counting.

## UI considerations

- Keep charts lightweight (CSS/SVG bars, a simple line) — no heavy chart lib on public
  or dashboard bundles; mobile-friendly.
- Analytics should answer an SME's real questions: "how many taps this week, from
  what, on which page, on what device."

## Security

- Analytics strictly scoped to the authenticated caller's account.
- Leads readable only by the owner; lead form protected with a honeypot + basic
  rate-limit + input validation; `submit_lead` sets `search_path`.
- No PII beyond what the visitor voluntarily submits; covered by the DPA consent notice
  (link a short consent line on the lead form).

## Performance

- Aggregate in SQL, not the client; bound every query by date. Note a future
  optimization: pre-aggregated daily rollup tables once event volume grows.

## Scalability

- RPC aggregation is fine at MVP volume with the existing index; rollups deferred until
  needed. Append-only events unchanged.

## Testing strategy

- Unit: UA parser; CSV formatting; lead input validation.
- Integration: analytics RPCs return only the caller's data; `submit_lead` writes and is
  visible to the owner only; cross-account isolation.
- E2E: generate taps/clicks → dashboard shows correct counts; submit a lead → appears in
  the list and CSV.

## Documentation

- Update `README.md` (run `0003`, leads + analytics), `PROJECT.md` phase, decision log
  if any decision arises (e.g. chart approach).

## Potential risks

- Geo/UA only meaningful on Vercel (local shows "unknown") — set expectations.
- RPC aggregation cost at scale — mitigated by indexes + date bounds; rollups later.
- Lead spam — honeypot + rate-limit + validation.
- Chart bundle bloat — mitigated by lightweight SVG/CSS.

## Technical debt review (end of sprint)

Confirm analytics scoping is airtight, `leads` RLS correct, no unbounded event scans,
and commit a `package-lock.json` if still outstanding — before Sprint 4 (Billing).

## Build status (2026-07-22)

**Shipped in-repo (no new dependencies — all dependency-free):**

- Migration `0003_analytics_leads.sql` — `leads` table with RLS (owner select/delete;
  writes only via RPC), `submit_lead` RPC, `get_account_overview` + `get_page_analytics`
  RPCs (account-scoped via `auth.uid()`), and the `lead` event type.
- Event enrichment: `lib/ua.ts` (device/OS) wired into the redirect path and
  `/api/track`; country from the Vercel geo header.
- Analytics UI: account overview strip on `/dashboard`; per-page `/dashboard/[id]/analytics`
  with dependency-free `components/mini-charts.tsx` (daily bars, device/top-button bars).
- Lead capture: editor toggle + headline/button; `components/lead-form.tsx` (name/phone/
  email + optional company/message, honeypot, consent line); `/api/lead`; owner list at
  `/dashboard/[id]/leads` with CSV export via `/api/leads/[id]/csv` (`lib/csv.ts`).
- Unit tests for `parseUA` and `toCsv` (pass).

**Needs Kelvin:** run migration `0003` in Supabase, `npm run build` (no `npm install`
needed — no new deps), push, then verify: taps/clicks show on analytics; enable the
lead form, submit one from the public page, see it in Leads + CSV.

**Deferred:** pre-aggregated daily rollups (only if event volume demands it); a formal
two-account analytics/leads isolation spot-check.

## Sprint 3 closeout (2026-07-22)

**Completed.** Events enriched with device/OS/country; owner analytics (account overview
+ per-page charts, dependency-free); lead capture end-to-end (public form → `leads`
table with RLS → owner list + CSV export); `submit_lead`, `get_account_overview`,
`get_page_analytics` RPCs; `parseUA`/`toCsv` unit-tested. Kelvin accepted the sprint.

**Decisions.** No new strategic decisions. Confirmed the `leads` table was never created
in Sprint 1 and built it fresh with RLS on from the start (closed a latent gap).

**Outstanding (non-blocking).** Formal two-account analytics/leads isolation spot-check;
analytics rollups if volume grows; commit `package-lock.json`.

**Risks.** Geo/UA only meaningful on Vercel (local shows "unknown") — expected. Lead
spam mitigated by honeypot + server validation.

**Next.** Sprint 4 — Billing (plans, M-Pesa STK push + Paystack, plan gating): the
recurring-revenue engine.
