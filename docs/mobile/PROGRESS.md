# Hornbill TapTap mobile app — progress

Live status against `docs/mobile/PLAN.md`. Newest first within each milestone.

| Milestone | Dates (brief) | Status |
|---|---|---|
| Step 1 — plan | by 27 Sep | ✅ Approved 28 Sep 2026 |
| **M0 — setup** | by Sat 31 Oct | 🟡 **In progress** — code done; Expo linked; first dev build next |
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
- [ ] Dev build on the Camon, following the phone's theme — Expo linked 28 Sep; **the build is yours to
      run** (step 5 under "What you need to do").
- [x] Token parity and contrast tests pass (114). 28 Sep.
- [ ] First cold-start measurement — needs a preview (release) build; a dev build is not representative.
- [ ] **NFC spike on the Camon** — code ready (`app/dev/nfc.tsx`); needs the dev build.
- [ ] NFC spike on the iPhone 14 — needs the Apple Developer account (needs the D-U-N-S number).
- [ ] Sentry shows a test crash — DSN received 28 Sep (US region) and set for local development in
      the git-ignored `mobile/.env.local`; needs the dev build. Preview and production builds get it
      from the EAS environment variable, set 28 Sep.
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
9. **`expo-doctor` flags `react-native-nfc-manager` as "untested on New Architecture"** (React Native
   Directory's metadata; 20 of 21 checks pass). That is the exact risk the Camon NFC spike settles
   (PLAN.md §4.6, §16). The warning stays visible until the spike passes; only then is the package
   excluded from that check, with a pointer to the result.
10. **`eas init` copies resolved config into `app.json`.** Besides the project id and owner it wrote
    `extra.variant: "development"` and `extra.router: {}` — harmless, because `app.config.ts` sets
    both itself, but a stale "development" in the static file misleads, so both were removed and all
    three variants re-checked. Other EAS commands that edit config (e.g. `eas update:configure`,
    M7) probably do the same: check `app.json` after each. **Confirmed on the first build attempt**
    (finding 11), with worse values.
11. **The first `eas build` stopped to install `expo-updates`**, which the scaffold had left out
    although `eas.json` gives every profile an update channel (PLAN.md §4.3 plans EAS Update). EAS
    installed it at the SDK 57 pin (`~57.0.23`, `expo install --check` clean), then stopped with
    "Command must be re-run". Configuring it copied the **development** variant's resolved config
    into `app.json` — `.dev` bundle IDs, permissions, runtime version. `app.config.ts` overrides all
    of them per build, so nothing was wrong yet, but a store build would inherit the dev IDs the day
    that file stopped setting them. `app.json` is trimmed back to the project id, owner and
    `updates.url` (the one new value that belongs there), and `app.config.ts` now says to trim it
    after any EAS command. Re-checked: all three variants resolve to the right IDs with the update
    URL and runtime version; the Android permissions are unchanged; `expo-updates` waits 0 ms at
    launch (`LAUNCH_WAIT_MS=0`), so it never delays start-up; mobile typecheck, lint and 148 tests
    green.
12. **The first two dev builds failed in Gradle** (`5e141a2a` from your terminal, `9e9ab89e` from
    mine, 28–29 Sep): `resource drawable/splashscreen_logo … not found` at
    `:app:processDebugResources`. Expo's Android splash theme always points at that drawable, but
    the splash plugin only generates it from an `image`, and ours set background colours only.
    Fixed with `mobile/assets/splash-placeholder.png` — a fully transparent 512 px PNG (1 KB), so the
    splash shows just the theme colour. The hornbill mark replaces it in M8: as it stands its dark
    body would vanish on the dark splash and its edges carry a yellow halo, and `/logo` is
    git-ignored, so putting it in the public repo is your call. Verified with a local
    `expo prebuild`: the drawable now exists at all five densities and the theme references it (no
    Android SDK on this PC, so the cloud build is the full test). **Also confirmed from the build
    log:** EAS ran `npm ci` in `build/mobile` only — the web's packages are never installed (PLAN.md
    §5.2 ✅). Harmless: prebuild warns it "cannot set minimum buildscript.ext.compileSdkVersion";
    peer-dependency warnings are for optional and test-only packages. The two failed builds used
    2 of this month's 15 free Android builds.

### Commits (28 Sep, approved)

- `8550abf` Fence the web build off from the mobile app
- `2de8589` Scaffold the Expo app for card owners (mobile M0)
- the docs commit that carries this file

### Expo — linked 28 Sep

- **Login:** `kevdev001`, which owns the **`hornbill-taptap`** organisation.
- **`eas init`:** project **`@hornbill-taptap/hornbill-taptap`**, id `7b93f8b1-d6f4-4509-a206-f67a2a78dbac`
  (<https://expo.dev/accounts/hornbill-taptap/projects/hornbill-taptap>). It belongs to the
  organisation rather than a personal account (your choice, 28 Sep), so builds, signing keys and
  the paid plan from late November sit with the company, and another developer can be added
  without your login. Moving a project later keeps its id, but Expo limits how often a project can
  move. `mobile/app.json` holds only the id, the owner and the EAS Update URL (findings 10, 11).
- **`EXPO_PUBLIC_SENTRY_DSN`** set on EAS for **preview** and **production**, as plain text — Expo's
  own convention for `EXPO_PUBLIC_` values, which ship inside the app anyway. Checked identical to
  `.env.local`. **development** holds nothing on purpose: a dev build loads its JavaScript from
  `npx expo start` on the PC, which reads `.env.local`.
- **Which EAS environment each build profile reads** (EAS's defaults, confirmed in eas-cli 24.8.0's
  source): `development` → development (a dev client), `preview` → preview (internal
  distribution), `production` → production (store distribution).
- **Pre-flight for the first build:** the upload is about 5.1 MB (433 files — git-ignored files,
  `node_modules`, `/marketing` and `/logo` stay behind; `../lib` goes up, which the app needs);
  `expo-dev-client` is installed; `expo-doctor` passes 20 of 21 (finding 9).

### What you need to do

1. **Request the D-U-N-S number** for Hornbill Technologies Limited through Apple's free lookup
   tool: <https://developer.apple.com/enroll/duns-lookup/>. It can take up to ~30 days, and both
   store accounts wait on it. Then enrol in the Apple Developer Program as an **Organization** and
   open a Google Play Console **Organization** account.
2. ~~Create a Sentry account and send the DSN~~ — done 28 Sep.
3. ~~On the Camon: NFC on, Chrome allowed to install apps~~ — done 28 Sep.
4. ~~Sign in to Expo from a separate PowerShell window~~ — done 28 Sep.
5. **Run the first dev build** — approved 28 Sep; builds run from your terminal. In PowerShell:

   ```powershell
   cd C:\Projects\taptap\mobile
   npx eas-cli@latest build --profile development --platform android
   ```

   - "Generate a new Android Keystore?" → **Y**. EAS creates and keeps the key that signs this build.
     It is for the dev app (`ke.co.hornbilltech.taptap.dev`) only, not the store app.
   - Anything about the app version → accept the default.
   - "Install and run the Android build on an emulator?" at the end → **n** (it goes on the Camon).
   - It uploads about 5 MB, waits in the free tier's queue (the wait varies), then builds for roughly
     15 minutes, and ends with a link and a QR code.
   - **Done means:** the build page says *Finished*; on the Camon, scanning the QR code (or opening
     the link in Chrome) downloads the APK, which installs as **TapTap Dev**. Then follow "What
     you'll test on the Camon" below.
   - Tell me when it has finished or failed. I'll read the build log — it should install only
     `mobile/`'s packages (PLAN.md §5.2) — and record the result here.
   - *28 Sep, first attempt:* stopped before uploading, to install `expo-updates` (finding 11) —
     fixed; re-run the same command.
   - *28–29 Sep, two builds:* failed in Gradle on a missing splash image (finding 12) — fixed; third
     build started 29 Sep.

### Build notes

- The `preview` profile skips Sentry source-map upload (`SENTRY_DISABLE_AUTO_UPLOAD`) until a
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
