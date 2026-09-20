# Launch checklist

**Last updated:** 2026-08-30 · Everything still open needs a person, not a commit —
except migrations `0017` and `0018`, which need applying.

Code status: all UI sprints delivered plus UI-13 and Sprint 6a (per-identity billing +
renewal reminders). Migrations `0005`–`0014` applied; **`0015` and `0016` are written and
not yet applied**. 405 tests green.
Production live and verified at `https://taptap.hornbilltech.co.ke`.

---

## ✅ Done and verified — do not re-raise

- **Leaked `service_role` key neutralised** (2026-08-14). Migrated to Supabase
  publishable/secret keys and disabled the legacy pair (D-010). The deployed bundle was
  scanned against the real values: no server-only secret reaches the browser.
- **DNS live**, HTTPS + HSTS, `NEXT_PUBLIC_SITE_URL` correct.
- **`ADMIN_TOKEN` set**; minting verified in production. Four cards minted, valid 32-hex
  tokens, all resolving.
- **Physical NFC verification — the UI-6 acceptance requirement outstanding since the UI-0
  audit.** Closed 2026-08-19 on real hardware with Magangi's cards:

  | Check | Evidence |
  |---|---|
  | Taps register | 26 tap events |
  | Attribution | 100% carry `source='nfc'` **and** a `tag_id` |
  | Right card → right page | 0 mismatches |
  | Android | 15 taps |
  | iPhone | 11 taps |
  | **Repoint without re-encoding** | card `16cd…` served `/mac-gerald`, then `/mac-shadrack`, then back — same chip, never rewritten |

  Geo capture worked on every event (`country=KE`), and `direct` events prove `source`
  genuinely discriminates an NFC tap from a typed URL.
- **First customer live.** Magangi and Company on Pro: three personal cards, encoded,
  claimed, labelled, all content correct. The full funnel fired on real hardware —
  `tap → view → click → download`, plus a lead.
- **Supabase auth URLs** corrected away from localhost (2026-08-19, reported by Kelvin).

---

## 1. Email — delivery is PROVEN on both paths; magic-link `next` is BROKEN

**Two different senders, and only one of them has been tested.** The application's own
notifications (lead arrival, renewal reminders, dispatch) go through `lib/notifications/send.ts`
straight to the Resend API. Magic links and password resets are sent by **Supabase Auth**, from
its own SMTP settings. Proving one says nothing about the other.

### 1a. Resend (the app's own mail) — done 2026-09-20 ✅

First production email ever accepted AND delivered: the "on its way" dispatch notice for a test
order, **landed in the inbox, not spam**. Resend message id `01a0bda3-16ed-724f-b1d5-65103778ef9c`.
That exercised the whole chain — ops UI → `dispatchOrderAction` → `record_dispatch` → `after()` →
`dispatch_notification_target` → `composeDispatchEmail` → Resend → inbox — and confirmed the
`hornbilltech.co.ke` sending domain has working SPF/DKIM. The delivery log recorded `sent` with a
provider id, and a duplicate was refused by `notification_deliveries_once_idx` (`23505`).

Renewal reminders and lead emails ride the same transport and sending domain, so their
deliverability is now reasonably evidenced too — though neither has been fired in production.

### 1b. Supabase Auth mail (magic links, password resets)

**Same provider, different transport.** Auth mail does not use the Resend API; it goes over
**Resend SMTP** — verified in the remote config on 2026-09-20: `smtp.resend.com:465`, user
`resend`, sender `Hornbill TapTap <noreply@hornbilltech.co.ke>`. So it shares the sending domain
and DNS records proven in §1a, and only the transport differs.

`auth.rate_limit.email_sent` is already raised to **30** (the default of 2 assumes the throttled
built-in mailer), and `max_frequency` is `1m`.

**Tested 2026-09-20. Two of three pass.**

1. ✅ **Arrives, in the inbox not spam**, from `Hornbill TapTap <noreply@hornbilltech.co.ke>`.
   Deliverability for auth mail is proven.
2. ✅ Sender is our own domain, not Supabase's.
3. ❌ **`next` is still lost.** Signing out, hitting `/admin`, being bounced to
   `/login?next=/admin` and using the emailed link does **not** land on `/admin`. Reproduced
   through the app's own flow, not just a hand-rolled request.

**Root cause NOT yet found.** What has been ruled out:

- The allowlist (§1c): `generate_link` preserves `/auth/callback?next=/admin` verbatim and
  refuses off-site URLs, so Supabase accepts the query string happily.
- The app's construction: `login-form.tsx` builds
  `${origin}/auth/callback?next=${encodeURIComponent(next)}` and passes it as
  `emailRedirectTo`, which is the correct supabase-js shape.
- `/login` validating and forwarding `next` (`page.tsx` → `safeNext` → form prop).
- `safeNext` defaulting: a missing `next` yields `/dashboard`, so landing anywhere else means
  the callback did not run with the parameter attached.

**Where to look next:** capture the actual href of the emailed link and compare it to what
`generate_link` produces for the same input. That single comparison separates "supabase-js
sent it differently" from "the verify redirect drops it". Until then this is an open bug, not
a configuration error.

**Impact is limited:** password sign-in works, and that is how staff reach `/admin` today. It
hurts new customers, for whom the magic link is the default path, and staff following the
`/admin` gate.

### 1c. The redirect allowlist is CORRECT — earlier note retracted

An earlier version of this file claimed the allowlist held only the bare origin. **That was
wrong.** The remote config actually contains:

```
https://taptap.hornbilltech.co.ke/auth/callback
http://localhost:3000/auth/callback
https://taptap.hornbilltech.co.ke/**
```

The claim came from watching `POST /auth/v1/admin/generate_link` return a link whose
`redirect_to` had been trimmed to the origin. That is a behaviour of the **admin generate_link
endpoint**, not evidence about the allowlist, and it says nothing about the ordinary magic-link
flow — which is what step 3 of §1b actually tests. Nothing was changed to "fix" this.

### 1d. Never run `supabase config push` against this project ⚠️

`supabase config pull` **cannot** capture the SMTP block, because writing it requires the SMTP
password, which the API will not return; the CLI skips it as `would_invalidate`. The pulled
`config.toml` is therefore an incomplete picture of production, and pushing it would **disable
production auth email and Twilio**, reset `site_url` and replace the redirect allowlist.

`supabase/config.toml` is deliberately absent from this repo for that reason. Migrations do not
need it: `supabase db push` works from the link state in `supabase/.temp`. If you ever do need
it, `supabase init && supabase config pull --force`, then delete it again when done.

---

## 2. Prove the M-Pesa callback end to end — **the only thing blocking revenue**

STK *initiation* was verified locally in Sprint 4. **Activation has never been proven**,
because Daraja cannot reach `localhost`.

1. Set `MPESA_CALLBACK_URL` to `https://taptap.hornbilltech.co.ke/api/mpesa/callback` in the
   Daraja app **and** in Vercel.
2. From Billing, either **Get a device** (a hardware order) or select a card and **Renew**,
   using a sandbox test number. The hardware path is the better test: it exercises order
   creation, payment and identity provisioning in one go.
3. Confirm a `payments` row moves `pending` → `paid`, the renewed device's
   `nfc_tags.term_end` moves a year out, and the Billing screen updates.
4. **Replay the same callback** and confirm `term_end` does **not** move twice. The
   `payment_tags` link exists precisely so a replay extends the same devices; this is the
   one thing tests cannot cover without a live database.

Until this passes, **nobody can buy anything** — Magangi's Pro was granted by hand.

---

## 3. ~~Confirm the plan prices~~ — SETTLED (D-018, 2026-08-30)

Prices are confirmed and the model changed with them: billing is **per identity**, not per
account plan. Smart Card KES 1,500 and Smart Stand KES 2,000, each including the first
twelve months; KES 1,000 per active device per year after that. `PRICES_ARE_DRAFT` and
`lib/plans.ts` are both gone.

**What replaced this item — apply migration `0015`.**

1. Run the Phase 0 reconciliation query first (read-only). Its last column flags any paid
   account holding **zero claimed devices** — those convert to no identities at all and need
   a decision per account. Nothing invents an identity for a card that does not exist.
2. Apply `0015_per_identity_billing.sql` in the Supabase SQL editor.
3. Apply `0016_renewal_reminders.sql`, and set **`CRON_SECRET`** in Vercel — the reminder
   cron refuses to run without it. Vercel generates a strong value when you add the cron.
4. Tap a lapsed card and confirm the branded "not active right now" screen renders rather
   than a 404.
5. Check the first scheduled run in Vercel's cron log. `/api/cron/renewals` returns a JSON
   summary (accounts examined, emails sent, failures) — that is where a Resend problem
   surfaces.

Until `0015` is applied the app runs in its fail-open path: every account keeps the
capabilities it had, and Billing shows a migration notice.

---

## 4. Rotate the Daraja sandbox credentials

`MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET` were exposed in the same leak as the
Supabase key. Regenerate at developer.safaricom.co.ke, update `.env.local` + Vercel.

---

## 5. Legal

- ~~Fill the `[bracketed]` placeholders in `/privacy` and `/terms`.~~ **Done 2026-08-31.**
  Both pages now name **Hornbill Technologies Limited, Mombasa, Kenya** as the data
  controller, with `info@hornbilltech.co.ke` and `0759 293 030` as the contact route. A test
  in `app/legal-pages.test.tsx` fails the build if a placeholder ever returns, because a page
  reading "operated by [legal entity name]" renders perfectly and only embarrasses a human
  who reads it.
- **Complete Hornbill's ODPC registration.** Still open. External, with lead time, and the
  one part of this item nobody can write code for.

You are the data controller for every lead your customers submit, and Magangi's cards are
already collecting them.

---

## 6. Drag-and-drop reordering

The last part of the builder never exercised by a person. Creating Magangi's three profiles
covered creation, slug validation, template seeding, logo upload and publish. Reordering
blocks by drag — and by keyboard, which is why dnd-kit was chosen — is still only covered
by tests.

---

## 7. Google sign-in — deferred, code already in place

Waiting on a payment card for Google Cloud. When ready:

1. Google Cloud → OAuth 2.0 Client ID (Web). Authorised redirect URI is
   `https://<project-ref>.supabase.co/auth/v1/callback` — **Supabase's URL, not ours**.
2. Supabase → Authentication → Providers → Google → paste Client ID + Secret.
3. Set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true` in Vercel **and redeploy** — `NEXT_PUBLIC_*`
   is inlined at build time, so an env change alone does nothing.

The button is hidden until step 3, so it can never fail in front of a user.

---

## ~~Recommended first thing after launch: notifications~~ — SHIPPED

Lead-arrival email landed in **Sprint UI-13** (`e6d3f03`, 2026-08-19) with migration `0014`:
a lead arrives, the business is emailed, and notification preferences live in Settings.
Resend deliverability is now proven (§1a), so this is unproven only in that it has not
itself been fired in production.

## Recommended next

~~**Sprint 6c — the operations console.**~~ **Built** (migration `0018`, D-020). Before
deploying it, run the `staff` insert in `docs/sprint-6c-ops-console.md` — `/admin` now
requires a staff row and there is deliberately no UI to grant one, so without it you lock
yourself out of card minting.

**Next after that:** team management (D-017) is the largest thing still deferred — roles,
invites and per-profile assignment on a single account. Nothing is blocking it; the schema
has always allowed it.

~~**Renewal reminder emails.**~~ **Built** (migration `0016`, 2026-08-30). Daily cron at
06:00 UTC / 09:00 EAT, warning at 30 days, 7 days, on the day, and again if a card actually
stops. Needs `CRON_SECRET` set and `0016` applied — see §3. Note these ride on Resend, so
§1 gates them too: an unproven mail path means unproven reminders.
