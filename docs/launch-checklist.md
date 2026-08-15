# Launch checklist

**Last updated:** 2026-08-15 · Everything below needs a person, not a commit.

Code status: all UI sprints delivered, migrations `0005`–`0013` applied, 298 tests green,
login working in production.

---

## 1. Set a real `ADMIN_TOKEN` — do this first

`/admin` mints NFC card tokens and is **publicly reachable**, protected only by this secret.
Your `.env.local` still holds `change-me-to-a-long-random-string`.

Minting now refuses to run on a placeholder or anything under 24 characters, so the endpoint
is safe by default — but it also means **card minting is disabled until you set one**.

```powershell
# Generate a token
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

Put it in `.env.local` **and** in Vercel (Production), then redeploy.

**Verify:** open `/admin`, paste the token, mint 1 card. A wrong key should say "Invalid admin
key"; a placeholder should say the token is a placeholder.

---

## 2. Rotate the Daraja sandbox credentials

`MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET` were exposed in the same leak as the Supabase
key. Regenerate at developer.safaricom.co.ke and update `.env.local` + Vercel.

---

## 3. Confirm the plan prices

`lib/plans.ts` has carried a DRAFT marker since Sprint 4. **M-Pesa charges real money against
these numbers**, so launching on placeholders takes incorrect payments from real customers.

| Plan | Current DRAFT | Confirmed |
|---|---|---|
| Starter | KES 5,000 / yr | ☐ |
| Pro | KES 15,000 / yr | ☐ |
| Business | KES 40,000 / yr | ☐ |

Also review the limits beside each price (`maxProfiles`, `leadCapture`, `advancedAnalytics`).
When settled, delete `PRICES_ARE_DRAFT` from `lib/plans.ts`.

---

## 4. Prove the M-Pesa callback end to end

STK *initiation* was verified locally in Sprint 4. **Activation has never been proven**,
because Daraja cannot reach `localhost`.

1. Set `MPESA_CALLBACK_URL` to `https://<your-production-domain>/api/mpesa/callback` in the
   Daraja app **and** in Vercel.
2. Subscribe to a paid plan from Billing using a sandbox test number.
3. Confirm: a `payments` row moves `pending` → `paid`, `subscriptions.current_period_end` moves
   a year out, and the plan badge on Billing changes.

Until step 3 passes, **nobody can actually buy anything.**

---

## 5. DNS for `taptap.hornbilltech.co.ke`

Scoped for Sprint 1 and still not done — you are currently on a `*.vercel.app` URL.

1. Vercel → project → **Domains** → add `taptap.hornbilltech.co.ke`.
2. Add the CNAME Vercel shows to the `hornbilltech.co.ke` zone. The root domain's existing site
   is unaffected.
3. Set `NEXT_PUBLIC_SITE_URL=https://taptap.hornbilltech.co.ke` in Vercel and **redeploy** —
   it is baked in at build time and is what QR codes and card URLs encode.

⚠ **Do this before minting production cards.** Minted URLs bake in `NEXT_PUBLIC_SITE_URL` at
mint time, so cards minted now would point at the temporary domain forever.

---

## 6. Legal

- Fill the `[bracketed]` placeholders in `/privacy` and `/terms` — legal name, contact email.
- Complete Hornbill's **ODPC registration**. External, and it has lead time, so start it early.

You are the data controller for every lead your customers submit. The lead export and the
delete-lead button exist to serve erasure requests.

---

## 7. Physical NFC verification

An acceptance requirement from the UI-0 audit that has **never been met**. Needs real cards.

1. Encode a card with `https://<domain>/t/<token>` (NTAG213 is enough).
2. Tap on **Android** (background reading) and **iPhone** (iOS 14+; older models need Control
   Centre).
3. Confirm it opens the right profile, and that a `tap` event appears with `source = 'nfc'` and
   the correct `tag_id`.
4. Repoint the card to another profile in Devices, tap again — **the chip must not need
   re-encoding**. This is the core product promise.
5. Disable the card, confirm the tap stops resolving.
6. Print a QR from `/print/qr` at 100% scale and scan from ~30cm.

Until step 3 passes, per-card analytics is unproven against real hardware.

---

## 8. Click through the builder by hand

Covered by tests and typechecks, never exercised by a person: **drag-and-drop reordering**,
**image upload**, **publish/unpublish**, template switching. I verified the live preview by
typing, but not these.

---

## Recommended first thing after launch

**Notifications.** The only item from the original feature list that is both absent and
repeatedly missed: a lead arrives and nobody is told — an owner has to open the dashboard to
find out. Everything needed is already in place: the lead workflow, the business phone and
WhatsApp in Settings, and a stale-lead insight that already names exactly who has not been
replied to. It needs a provider decision (email vs WhatsApp vs SMS) which is a business call.
