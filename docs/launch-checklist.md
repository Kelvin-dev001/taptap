# Launch checklist

**Last updated:** 2026-08-19 · Everything still open needs a person, not a commit.

Code status: all UI sprints delivered, migrations `0005`–`0013` applied, 323 tests green.
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

## 1. Test Resend end to end — **do this before announcing anything**

Configured 2026-08-19 but **never exercised**. Magic links make email the entire login
path, so a deliverability fault is not a degraded experience — it locks people out.

Sign up at `/login` → **Email me a sign-in link**, then confirm:

1. It arrives, from the `hornbilltech.co.ke` sender rather than Supabase's
2. It lands in **inbox, not spam** — the real test of the SPF/DKIM records
3. Clicking it lands in `/dashboard` **already signed in** — this step has never worked

Also raise the auth rate limit in Supabase; the default assumes the throttled built-in
mailer.

---

## 2. Prove the M-Pesa callback end to end — **the only thing blocking revenue**

STK *initiation* was verified locally in Sprint 4. **Activation has never been proven**,
because Daraja cannot reach `localhost`.

1. Set `MPESA_CALLBACK_URL` to `https://taptap.hornbilltech.co.ke/api/mpesa/callback` in the
   Daraja app **and** in Vercel.
2. Subscribe to a paid plan from Billing using a sandbox test number.
3. Confirm a `payments` row moves `pending` → `paid`, `subscriptions.current_period_end`
   moves a year out, and the plan badge changes.

Until this passes, **nobody can buy anything** — Magangi's Pro was granted by hand.

---

## 3. Confirm the plan prices

`lib/plans.ts` has carried a DRAFT marker since Sprint 4. M-Pesa charges real money against
these numbers.

| Plan | Current DRAFT | Confirmed |
|---|---|---|
| Starter | KES 5,000 / yr | ☐ |
| Pro | KES 15,000 / yr | ☐ |
| Business | KES 40,000 / yr | ☐ |

Delete `PRICES_ARE_DRAFT` when settled.

**Decide the model, not just the numbers.** Plans meter Tap Profiles, not people, so a
three-person firm lands on Pro purely on profile count — that is how Magangi was priced.
Per-seat is the usual corporate shape. Worth settling before the next firm asks.

---

## 4. Rotate the Daraja sandbox credentials

`MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET` were exposed in the same leak as the
Supabase key. Regenerate at developer.safaricom.co.ke, update `.env.local` + Vercel.

---

## 5. Legal

- Fill the `[bracketed]` placeholders in `/privacy` and `/terms` — legal name, contact email.
- Complete Hornbill's **ODPC registration**. External, with lead time.

You are the data controller for every lead your customers submit, and Magangi's cards are
now collecting them.

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

## Recommended first thing after launch

**Notifications.** The only item from the original feature list both absent and repeatedly
missed: a lead arrives and nobody is told. Magangi has already received one. Everything
needed exists — the lead workflow, the business phone and WhatsApp in Settings, and a
stale-lead insight that already names who has not been replied to. It needs a provider
decision, and Resend now answers it for email.
