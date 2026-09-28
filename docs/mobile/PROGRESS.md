# Hornbill TapTap mobile app — progress

Live status against `docs/mobile/PLAN.md`. Newest first within each milestone.

| Milestone | Dates (brief) | Status |
|---|---|---|
| Step 1 — plan | by 27 Sep | ✅ Approved 28 Sep 2026 |
| **M0 — setup** | by Sat 31 Oct | 🟡 **In progress** — code done; waiting on accounts and the first builds |
| M1 — sign-in and shell | 2–6 Nov | Not started |
| M2 — profile, share, QR | 9–13 Nov | Not started |
| M3 — leads and analytics | 16–20 Nov | Not started |
| M4 — cards and NFC | 23–27 Nov | Not started |
| M5 — push | 23–27 Nov ⚠ | Not started |
| M6 — web ↔ app | 30 Nov–4 Dec ⚠ | Not started |
| M7 — hardening and betas | 30 Nov–4 Dec | Not started |
| M8 — store submission | 7–11 Dec | Not started |

---

## M0 — setup

### Done-means checklist (PLAN.md §15)

- [x] Root `typecheck`, `lint`, `test` and `build` green with `/mobile` present **and installed** —
      820 tests (the 787 before, plus 33 new guard tests). 28 Sep.
- [x] Preview deployment (`taptap-m7urqr69t-…vercel.app`, **not** production) builds and matches
      production on all 8 checks: `/`, `/login`, `/privacy`, `/pricing` (200); an unknown card token
      and an unknown slug (404 — both exercise the tap route and the database); `/api/qr` (200);
      `/dashboard` (307 to sign-in). The CLI considered 393 files and uploaded none from `mobile/`,
      `marketing/` or `logo/`. Real customer slugs were deliberately not requested, so no customer's
      analytics were touched. 28 Sep.
- [x] `mobile/` lint, typecheck and tests green (148 tests); the no-raw-strings and allowed-imports
      lint rules proven to fire. 28 Sep.
- [ ] Dev build on the Camon, following the phone's theme — **needs your Expo login and OK to build**.
- [x] Token parity and contrast tests pass (114). 28 Sep.
- [ ] First cold-start measurement — needs a preview (release) build; a dev build is not representative.
- [ ] **NFC spike on the Camon** — code ready (`app/dev/nfc.tsx`); needs the dev build.
- [ ] NFC spike on the iPhone 14 — needs the Apple Developer account (needs the D-U-N-S number).
- [ ] Sentry shows a test crash — DSN received 28 Sep (US region) and set for local development in
      the git-ignored `mobile/.env.local`; needs the dev build. Preview and production builds get it
      as an EAS environment variable once Expo is linked.
- [ ] SDK 57 vs 58 decision — due 31 Oct (SDK 58 beta since 15 Sep).

### Built on 28 Sep

**Web (approved W1, W2 — no runtime change):**

- `tsconfig.json`, `eslint.config.mjs` and `vitest.config.ts` exclude `mobile/`.
- `.vercelignore` (new) keeps `mobile/` out of Vercel uploads — see finding 2.
- `lib/mobile-shared.json` — the 15 `lib/` modules the app may import — and
  `lib/mobile-shared.test.ts`, which fails if one of them gains a package import, `process.env`, or
  a browser global.

**Mobile (`/mobile`):**

- Expo SDK 57 (React Native 0.86.3, React 19.2.3), standalone package, dependencies pinned by
  `npx expo install`; `react-native-nfc-manager` pinned to exactly `4.0.0-beta.9`.
- `app.config.ts`: development / preview / production variants (`APP_VARIANT` from `eas.json`);
  bundle IDs `ke.co.hornbilltech.taptap` and `…taptap.dev`; scheme `hornbilltaptap`; iPhone only;
  Android backups off; permissions limited to INTERNET, NFC and VIBRATE; Inter embedded; NFC
  entitlement `TAG` only; Sentry plugin; runtime version from the native fingerprint.
- `eas.json`: build profiles and update channels (`development`, `preview`, `production`).
- Theme: tokens (light = the web's, dark = new), typography (Inter per weight and platform),
  contrast maths — with tests.
- i18n: i18next with typed keys; `en.json`; a `formatNumber` helper (`en-KE`).
- Sentry: off without a DSN; personal data scrubbed from every event and breadcrumb (tested).
- NFC: a pure parser for the chip's link record (tested without hardware) and a thin wrapper around
  the library.
- UI: Text, Button, Card, Screen.
- Screens: a foundation screen (theme, type, buttons, checks) and a development-only NFC check.

### Verification (28 Sep)

| Check | Result |
|---|---|
| Web `tsc --noEmit` / `eslint .` | clean / clean |
| Web tests | 55 files, 820 passed |
| Web `next build` | success, route table unchanged |
| Mobile `tsc` / `eslint` | clean / clean |
| Mobile tests | 5 suites, 148 passed |
| Lint guards | a raw string, a raw accessibility label and a `@taptap/core/billing-context` import are all refused |
| `expo config --type introspect` | iOS NFC entitlement `["TAG"]`; usage text set; 4 Inter fonts; encryption exemption; Android storage and overlay permissions marked `remove` |
| Android bundle (`expo export`) | builds; 4.4 MB Hermes bytecode (the new baseline — PLAN.md §4.10 updated) |

### Findings

1. **Link-id bug (web)** — every Save re-creates a profile's actions. Documented in PLAN.md §2.2 and
   D-042; fixed in M2.
2. **Vercel CLI deploys were uploading git-ignored files.** The CLI does not read `.gitignore`, only
   its own short default list, so `/marketing` (~60 MB of video) and `/logo` went up with every
   `vercel --prod`. The new `.vercelignore` stops that from the next deploy; the preview deployment
   will confirm the smaller upload.
3. **Web accessibility (candidate web fix, not made):** orange text (`text-primary-strong`,
   `#C2560A`) is 4.54:1 on white cards but **4.38:1 on the page background (`#FBFBFA`)** — short of
   WCAG AA wherever it sits directly on the page. Red text on its pink badge fill is 4.41:1, and
   muted grey on the sunken grey is 4.35:1. D-012 checked against white only.
4. **NFC plugin default would get iOS uploads rejected.** It writes `NDEF` into the entitlement
   unless `includeNdefEntitlement: false` (App Store Connect ITMS-90778). Set, and verified by
   introspection.
5. **Expo's Android template asks for storage permissions** the app never uses. Blocked; Play's
   Data safety form stays simple.
6. **Expo Router 57 ships a 967 KB Material Symbols font** on Android (native tabs →
   `expo-symbols`). Decide in M1 whether native tabs use it; if not, strip it in M7.
7. **npm audit: 15 moderate**, from two roots. `uuid` is build-time tooling only.
   `decode-uri-component` ships inside Expo Router's URL parsing: a hand-crafted malformed link could
   hang the app until closed. The fix needs a major-version override that breaks the router, so M6's
   incoming-link guard will refuse over-long or malformed links before the router parses them.
8. **Sentry is on 7.11** (Expo's SDK 57 pin) while npm has 8.28 — staying on Expo's tested pin.

### Commits (28 Sep, approved)

- `8550abf` Fence the web build off from the mobile app
- `2de8589` Scaffold the Expo app for card owners (mobile M0)
- the docs commit that carries this file

### What you need to do

1. **Request the D-U-N-S number** for Hornbill Technologies Limited through Apple's free lookup
   tool: <https://developer.apple.com/enroll/duns-lookup/>. It can take up to ~30 days, and both
   store accounts wait on it. Then enrol in the Apple Developer Program as an **Organization** and
   open a Google Play Console **Organization** account.
2. ~~Create a Sentry account and send the DSN~~ — done 28 Sep.
3. ~~On the Camon: NFC on, Chrome allowed to install apps~~ — done 28 Sep.
4. **Sign in to Expo from a separate PowerShell window** — not from this chat. Open PowerShell and
   run `cd C:\Projects\taptap\mobile`, then `npx eas-cli@latest login`, then answer the prompts. The
   login is saved on this PC, so everything I run afterwards uses it. (A `!` command only runs when
   it is the whole prompt, and Expo's login asks questions a chat shell can't always answer — the
   same reason `supabase login` needs its own window.)

### Approved, waiting on the Expo login

- **`eas init`** — links this app to your Expo account (writes the project id into `app.json`).
- **EAS environment variable** `EXPO_PUBLIC_SENTRY_DSN` for preview and production builds.
- **`eas build --profile development --platform android`** — about 15 minutes in the cloud, free tier.
- Note: the `preview` profile skips Sentry source-map upload (`SENTRY_DISABLE_AUTO_UPLOAD`) until a
  Sentry auth token exists as an EAS secret. `production` has no such switch, on purpose: a store
  build must never ship without readable crash reports.

### What you'll test on the Camon, once the dev build is installed

1. On the PC: `cd mobile` then `npx expo start --dev-client`. Keep the phone on the same Wi-Fi,
   open **TapTap Dev**, and scan the QR code the terminal shows.
2. **Theme:** switch the phone between light and dark mode — the screen follows immediately.
3. **Text size:** set the phone's font size to the largest — nothing overlaps or gets cut off.
4. **NFC check → Scan a card**, then hold a TapTap card to the back of the phone. **Done means:**
   "TapTap card", its 32-character token, the link on the chip, and a time in milliseconds.
   - Hold a bank card or any other tag → "This isn't a TapTap card" or "This tag has no link on it".
   - Switch NFC off → "NFC is switched off", and "Open NFC settings" opens the right page.
   - During the scan, the browser must **not** open.
5. **Send a test error to Sentry** (once the DSN is in) → it appears in Sentry within a minute.
