# Sprint 5 — Hardware & Compliance — Plan

**Status:** ✅ Built — pending live verification (2026-07-24) · **Est:** ~2 weeks (roadmap weeks 10–11)
**Goal:** connect physical NFC cards to the platform (provision + claim + rebind, without
ever reprogramming the chip), and put the launch-blocking legal pieces in place (privacy
policy, consent, ODPC registration). After this, the beachhead can launch.

> Planning mode: for approval. No build until you sign off. Two pieces are external
> (hardware sourcing, ODPC registration) and run in parallel with the code.

## Prerequisites (Kelvin, in parallel)

- Source a small batch of **NFC tags** (NTAG213/215 stickers or PVC cards) and a way to
  encode a URL (an Android "NFC Tools" app is enough to start).
- Begin **ODPC registration** (Office of the Data Protection Commissioner) for Hornbill
  as a data controller — a legal/admin task, not code.

## Objectives

1. Give every physical tag a permanent identity that resolves to whatever page the owner
   binds it to — changeable from the dashboard, never re-encoded.
2. Let a customer claim a fresh card and bind it to their smart page.
3. Ship the compliance essentials: privacy policy, consent, terms, data-rights path.
4. Pass a public-page performance budget for low-end Android / expensive data.

## Key design decision (confirm) — token-based tags

Encode each tag with a permanent **token URL**: `taptap.hornbilltech.co.ke/t/<token>`.
The token is fixed on the chip forever; it resolves to the smart page the owner currently
binds it to. This satisfies the vision ("NFC never reprogrammed; destinations updated
from the dashboard") and supports rebinding, transferring, and deactivating a lost card —
none of which are possible if the slug is encoded directly onto the chip.

## Deliverables

- **Tag identity/resolve:** `/t/<token>` resolves the tag → its bound page and
  renders/redirects exactly like the slug (logging a `tap` with source = nfc). Unknown/
  inactive tokens show a friendly not-found.
- **Claim flow:** tapping an **unassigned** tag opens a claim page → sign in → bind the
  token to a chosen (or new) smart page → tag becomes assigned.
- **Dashboard tag management:** list a page's tags; rebind to a different page; deactivate
  (e.g. lost card).
- **Provisioning (admin):** a protected way for you to mint a batch of tokens and export
  their `/t/<token>` URLs for encoding/printing (protected by an `ADMIN_TOKEN` secret).
- **Compliance:** `/privacy`, `/terms`, a cookie/analytics notice, the existing lead
  consent line, and a documented data-subject-rights (access/delete) path.
- **Performance pass:** optimize avatar images, keep public JS minimal; target Lighthouse
  ≥ 90 on mid-tier mobile.

## Acceptance criteria

- Tapping an unclaimed tag lets a signed-in owner bind it; tapping a claimed tag behaves
  like its bound page and logs an NFC tap.
- An owner can rebind or deactivate a tag; a deactivated tag stops resolving.
- Tokens are unguessable; one account cannot claim/rebind another account's tag.
- `/privacy` and `/terms` exist and are linked from public pages and the footer.
- Public page meets the performance budget on a throttled mobile profile.

## Architecture

- New route `app/t/[token]/page.tsx` mirroring `[slug]`: an RPC `resolve_tag(token)`
  returns either the bound public page (reuse the page-mode render / redirect) or an
  `unassigned` signal → the claim page.
- Claim + rebind + deactivate via server actions (owner-scoped through RLS).
- Provisioning via an admin-only route/action guarded by `ADMIN_TOKEN` (server env),
  minting rows with random tokens.

## Database considerations (migration 0005)

- Extend `nfc_tags` (exists from 0001): add `token` (unique, indexed), `label`,
  `is_active`; `account_id` nullable until claimed; keep `smart_page_id`, `status`,
  `claimed_at`.
- RLS: owner can select/update their claimed tags; the resolve + claim paths use
  SECURITY DEFINER RPCs (`resolve_tag`, `claim_tag`) so anon taps never touch the table.
- Reserve the `t` slug so it can't collide with the tag route.

## UI considerations

- Claim page: dead-simple ("This card isn't set up yet — sign in to link it to your
  page"). Tag management sits inside the existing page view.
- Privacy/terms: clear, plain-language, Kenya-DPA-aware.

## Security

- Tokens are long and random (unguessable); tag tables never exposed to anon.
- Claim binds only to the claiming user's account; rebind/deactivate owner-only.
- `ADMIN_TOKEN` server-only; provisioning not reachable by customers.
- Privacy: minimize PII; document retention; honor delete requests.

## Performance

- Optimize avatar delivery (Supabase image transform or `next/image`); keep the public
  bundle lean; measure on a throttled profile.

## Scalability

- Token lookup is indexed; provisioning batches are small; nothing here changes the
  event/append model.

## Testing strategy

- Unit: token generation/validation; tag state transitions (unassigned→assigned→
  deactivated).
- Integration: `resolve_tag` returns the bound page or unassigned; `claim_tag` binds only
  to the caller's account; cross-account claim/rebind blocked.
- E2E: mint a token → tap (claim) → bind → tap again (renders + logs nfc tap) → rebind →
  deactivate.
- Manual: encode a real NFC tag, tap on Android + iPhone.

## Documentation

- README: provisioning steps, `ADMIN_TOKEN`, encoding a tag, privacy/terms; update
  `PROJECT.md`, decision log (confirm token-based tags as D-009), and a launch checklist.

## Potential risks

- iOS/older-Android NFC quirks — QR fallback already covers non-NFC devices.
- ODPC registration lead time — start early; it's external.
- Hardware fulfillment/COGS — pilot with a small batch first.
- Claim UX confusion — keep the claim page extremely simple.

## Technical debt review (end of sprint)

Confirm tag RLS + SECURITY DEFINER paths are airtight, provisioning is admin-gated, no
duplicate render logic between `/[slug]` and `/t/[token]`, and the launch checklist is
complete.

## Build status (2026-07-24)

**Decision:** D-009 token-based tags (slugs kept for sharing).

**Shipped in-repo:**

- Migration `0005_nfc_tags.sql` — `nfc_tags` (account nullable until claimed) + RLS +
  `resolve_tag` / `claim_tag` RPCs. Reserved the `t` slug.
- `lib/tags.ts` — token generate/validate/URL (+ unit tests, pass).
- `/t/[token]` — assigned → 302 to the bound slug (`?src=nfc`; reuses the slug
  render/log path, no duplicate logic); unassigned → claim flow (sign-in prompt or
  page picker).
- `/admin` — `ADMIN_TOKEN`-gated minting: batch tokens + export `/t/<token>` URLs.
- Dashboard → **Cards** (`/dashboard/tags`) — repoint / disable / enable claimed cards.
- Compliance: `/privacy` and `/terms` (Kenya-DPA-aware, `[bracketed]` placeholders to
  fill) + a Privacy link in the public footer.

**Needs Kelvin:** run migration `0005`; set `ADMIN_TOKEN` (local + Vercel); mint at
`/admin`; test the loop by opening a `/t/<token>` URL in a browser (no card needed);
fill the privacy/terms placeholders; progress ODPC registration; encode a real card
when the batch arrives.

**Deferred:** post-login "return to the tapped card" redirect (for now: sign in, then
tap again); per-event NFC-vs-web source attribution; bulk QR image export.

## Launch readiness (end of Sprint 5)

With Sprints 0–5 done, MVP is feature-complete for the beachhead: tap (NFC/QR) → smart
page → analytics → leads → paid plan, with compliance in place. Remaining before public
launch: confirm billing on Vercel, final pricing, the live subdomain (DNS), ODPC
registration, and a hardware pilot with the first cohort.
