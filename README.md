# Hornbill TapTap

Smart Digital Identity & Customer Engagement Platform. A business owns a permanent
link (`taptap.hornbilltech.co.ke/<slug>`) that any NFC tag or QR code points to; it
renders a smart page or redirects to a single destination. Owners edit destinations
from a dashboard — the hardware is never reprogrammed.

> Planning docs live in `PROJECT.md` and `docs/`. This README covers running the code.

**Stack:** Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth,
RLS), deployed on Vercel. Sprint 1 delivers the foundation: auth, tenancy, the
Smart Profile engine (redirect mode), slug reservation, and the edge redirect service.

## Prerequisites

- Node.js 20+
- A free Supabase project
- (For deploy) a Vercel account and access to Hornbill's DNS for `hornbilltech.co.ke`

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # http://localhost:3000
```

### Supabase

1. Create a project at supabase.com.
2. **Run the migrations in order:** open the Supabase SQL Editor and run
   `0001_init.sql`, then `0002_page_mode.sql`, then `0003_analytics_leads.sql` (all in
   `supabase/migrations/`). These create the tables, RLS policies, the RPCs
   (`resolve_slug`, `get_public_page`, `log_event`, `submit_lead`,
   `get_account_overview`, `get_page_analytics`), the sign-up trigger, the `page-assets`
   Storage bucket, and the `leads` table.
3. **Get your keys:** Project Settings → API → copy the Project URL and the `anon`
   public key into `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. **For quick testing:** Authentication → Providers → Email → you may turn off
   "Confirm email" so sign-up logs you in immediately. (Re-enable before launch.)

### Try the core loop

1. Go to `/login`, create an account, and sign in.
2. On `/dashboard`, create a redirect link (e.g. slug `java-house` →
   `https://wa.me/2547XXXXXXXX`).
3. Visit `http://localhost:3000/java-house` — you should be 302-redirected, and an
   `events` row (type `tap`) should appear in Supabase. Add `?src=qr` to log a `scan`.

## Scripts

```bash
npm run dev         # local dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run test        # vitest (slug logic)
```

## Deploy (Vercel + DNS)

1. Push this repo to GitHub and import it into Vercel.
2. Add the env vars from `.env.local` in Vercel (set `NEXT_PUBLIC_SITE_URL` to
   `https://taptap.hornbilltech.co.ke`).
3. In Vercel → Project → Domains, add `taptap.hornbilltech.co.ke`.
4. In Hornbill's DNS for `hornbilltech.co.ke`, add the **CNAME** record Vercel shows
   for the `taptap` subdomain (the root domain's existing project is unaffected).
   SSL is issued automatically once DNS resolves.

## Project structure

```
app/
  [slug]/route.ts        # edge redirect service (the tap target)
  dashboard/             # owner dashboard + server actions
  login/                 # auth
lib/
  slug.ts                # slug validation + normalization
  reserved-slugs.ts      # reserved names
  url.ts                 # safe-destination guard
  supabase/              # server / client / edge / middleware clients
supabase/
  migrations/0001_init.sql  # schema, RLS, RPCs, triggers
docs/                    # planning: charter, discovery, blueprint, decision log
```

## Notes / known limits (Sprint 2)

- **Page mode** now renders at the slug (digital card / multi-action page); redirect
  mode still works. Build one via Dashboard → create → Edit.
- Redirect logging is now fire-and-forget via `after()`; slug-resolve caching is still
  a follow-up.
- Auth is email/password (minimal). Analytics dashboard, leads, and billing are later
  sprints per `docs/sprint-0-blueprint.md`.
