# Hornbill TapTap mobile app — plan

**Status:** **Approved by Kelvin, 28 September 2026** (questions 1–5 answered, §18). M0
code-complete, phone checks outstanding; **M1 started early, 9 October 2026, with approval**;
**M2 started 11 October 2026, with approval** (its link-id fix is D-046); **M3 started the same day,
with approval** (push registration waits for Firebase) — see
`docs/mobile/PROGRESS.md`.
**Date:** 27 September 2026 · **Branch:** `mobile-app` (from `main` at `8e9b989`)
**Read with:** `docs/mobile/BRIEF.md`, `PROJECT.md`, `docs/decision-log.md` (D-001 … D-033)

This is step 1 of the brief: the plan, then a stop. Everything below was checked against
the code at `8e9b989`, migrations `0001`–`0029`, and the store policies and library releases
as published on 27 September 2026. Where something is my inference rather than something I
verified, it says so.

**Web baseline, recorded before any change:** 787 tests in 54 files pass, `tsc --noEmit` is
clean, `eslint .` is clean. Every milestone must leave all three exactly that green.

New to mobile? §1 explains every mobile term this plan uses, in plain English.

---

## 0. The short version

### What I recommend

1. **A native app built with Expo SDK 57** (React Native 0.86, React 19.2, TypeScript strict,
   Expo Router), living in **`/mobile` as its own package** — not a workspace. The web build
   never sees it.
2. **The app shares the web's pure logic** by importing an allow-listed set of `lib/` files
   directly (identity, entitlement, blocks, analytics, leads, …). No web file moves. A web test
   fails if anyone adds a server-only import to a shared file.
3. **Reads go straight to Supabase** with the user's own session, through the RLS policies and
   `SECURITY DEFINER` functions the web already uses. **Writes that carry business rules go
   through small versioned Next.js routes** (`/api/app/v1/…`) that accept the Supabase access
   token as a Bearer header. No secret ever ships in the app.
4. **Sign-in:** email + password, and a 6-digit code by email. Links in emails are a bonus, never
   the only way in.
5. **No purchases, no prices, no "renew" buttons, no links to pay.** I checked Apple's guideline
   3.1.3(f) and Google Play's Payments policy today: the brief's approach is compliant and is the
   safest one available. It needs its own neutral wording, because the web's strings say
   "renew now" (§3).
6. **NFC:** tapping a card in the app identifies which of *your* cards it is and points it at a
   profile — `claim_tag` exactly as D-027 left it ("link a card I own"). Claiming an unowned card
   stays impossible.
7. **Push** through Expo's push service for new leads, a card's first tap, and card terms ending —
   with no customer names or numbers in the notification text.
8. **Offline-first:** every screen paints from a cache, safe edits queue while offline, and no
   screen is ever blank.
9. **Account deletion** is a new server capability. A naive delete would cascade into payments
   and orders, so it anonymises financial records instead of deleting them.
10. **Timeline:** achievable, with four flagged slips. The biggest is the Apple and Google
    organisation accounts, which need a D-U-N-S number — that request should go in this week.

### Where this plan departs from the brief, and why

| # | The brief says | This plan says | Why |
|---|---|---|---|
| 1 | "Claim a card by tapping it with NFC" | The tap links a card **you already own** to a profile | D-027 closed self-claiming because every stock card prints its QR, so a photograph was a free card. Cards now join an account at fulfilment (D-026). Claiming *unowned* cards needs the activation codes D-027 deferred — a separate decision. |
| 2 | Sessions in `expo-secure-store` | Encryption key in SecureStore; encrypted session in AsyncStorage | SecureStore refuses values over 2,048 bytes and a Supabase session is larger. This is the pattern Supabase documents. |
| 3 | NFC via `react-native-nfc-manager` | Same library, **v4 (beta)**, proven on real hardware in M0, with a ~200-line local module as the fallback | The stable v3 line supports only React Native's old architecture; SDK 57 runs only the new one. v4 is `4.0.0-beta.9` (8 Sep 2026). |
| 4 | Sentry in M7 | Sentry in **M0** | It must be live before the first beta anyway, costs an hour, and catches crashes while we build. |
| 5 | M4 (cards) and M5 (push) in the same week | Push's database table and device registration move into **M3** | Two milestones in one week is the likeliest slip in the timeline. |
| 6 | "In-app account deletion" | A new migration and server route that **anonymises** rather than deletes financial records | Nothing deletes an account today, and `payments` and `orders` cascade-delete with `accounts` (`0004:13`, `0017:100`). Tax law expects those records kept. |
| 7 | Editor with live updates | **Fix the link-id bug first** (M2) | Every web save deletes and re-creates a profile's actions, which orphans click history and — by my reading — drops clicks on the live page until the next publish (§2.2). An autosaving editor would trigger it constantly. |
| 8 | Drag-and-drop feel | **Move up / move down** buttons in v1 | WCAG 2.2 criterion 2.5.7 requires a non-drag way to reorder anyway, and it keeps two heavy native libraries out of v1. |
| 9 | "TapTap" | Store name **"Hornbill TapTap"**, link scheme `hornbilltaptap://` | "TapTap" alone is a large game-store brand (its app uses `taptap://`), and store names must be unique. |
| 10 | Light and dark mode | Kept — **the app follows the phone's theme** | CLAUDE.md §8 keeps the *web* light-only for its phase. The app diverges on purpose; that is recorded as a decision (§17). |

---

## 1. Mobile concepts in plain English

- **Expo and the Expo SDK.** Expo is a toolkit on top of React Native that gives us one
  TypeScript codebase for Android and iPhone, plus ready-made native pieces (notifications, secure
  storage, image picker). Each numbered "SDK" pins versions that are known to work together; we
  start on SDK 57, released 30 June 2026.
- **Expo Go vs a development build.** Expo Go is a sample app from the stores that runs simple
  projects, but it cannot contain extra native code such as NFC. A **development build** ("dev
  build") is *our* app, compiled once with all our native pieces, which loads the JavaScript from
  the laptop so changes appear in seconds. You install it on the Camon like any APK.
- **EAS — Build, Submit, Update.** Expo Application Services are cloud machines that compile the
  app (Build — including iOS, so no Mac is needed), upload it to the stores (Submit), and deliver
  JavaScript-only fixes to installed apps without a store review (Update).
- **Over-the-air (OTA) update and runtime version.** An EAS Update swaps the app's JavaScript and
  images the next time it opens; it cannot change native code. A "runtime version" fingerprint
  makes sure an update only reaches builds whose native code matches.
- **Bundle ID / package name.** The app's permanent identity on each store, written as a reversed
  domain: `ke.co.hornbilltech.taptap`. Once published it can never change — a different ID is a
  different app.
- **Signing.** Stores only accept apps signed with a private key that proves who built them:
  a *keystore* on Android; a *distribution certificate* plus *provisioning profile* on iOS. EAS
  creates and stores these for us, so nothing secret sits on the laptop or in the public repo.
- **TestFlight.** Apple's beta-testing app. We upload a build, invite testers by email, and they
  install it from TestFlight. Up to 100 people on the team need no review; wider outside testing
  needs a short Apple review first.
- **Google Play testing tracks.** Play has *internal* (up to 100 testers, live in minutes),
  *closed*, *open* and *production* tracks. We beta on internal testing and promote the same build
  when ready. Organisation accounts skip the "12 testers for 14 days" rule that new personal
  accounts face.
- **iOS Developer Mode.** Since iOS 16 an iPhone must have Developer Mode switched on
  (Settings → Privacy & Security → Developer Mode) before it will run a development build. It asks
  for a restart and can be switched off later.
- **Universal Links (iOS) and App Links (Android).** Ordinary `https://` links that open the app
  instead of the browser when the app is installed. The website publishes two small files that
  list exactly which paths the app may take over; everything else stays in the browser.
- **Config plugin.** A small script that edits the native Android and iOS project files during
  the build, so nobody hand-edits Xcode or Gradle files. NFC, notifications and Sentry each add one.
- **New Architecture and Hermes.** React Native's current internals and its JavaScript engine,
  which is tuned for fast start-up on low-end Android. SDK 57 requires the New Architecture, so
  every native library must support it — which is why the NFC library gets tested first.
- **AAB.** The Android App Bundle we upload to Play. Play turns it into a phone-specific APK,
  which keeps the download small.

---

## 2. What the audit found

### 2.1 What the app can build on

- **Auth.** Email + password and email links, handled by `app/auth/callback/route.ts`. Email links
  use `token_hash` rather than PKCE, so they work in whichever browser opens them
  (`route.ts:21-27`, `:65-73`). Supabase Auth mail goes out through Resend SMTP (launch checklist
  §1b). Google sign-in is shipped but hidden behind a flag.
- **Reads are already app-shaped.** Every owner-facing read is either an RLS-scoped select or a
  `SECURITY DEFINER` function keyed on `auth.uid()` — `get_dashboard_overview`, `get_analytics`,
  `get_leads`, `get_lead_counts`, `get_devices_overview`. The app calls them with the user's
  session exactly as the web does: one call per screen, no N+1.
- **Most writes are database functions.** `publish_page`, `unpublish_page`, `claim_tag`,
  `rebind_tag`, `set_tag_status` and `replace_tag` enforce their own rules (D-021, D-025, D-027).
  The app can call them directly and cannot get around them.
- **Pure logic is shareable as it stands.** An import scan of `lib/` found these modules free of
  framework and server imports: `identity`, `entitlement`, `pricing`, `profile`, `blocks`,
  `analytics`, `metrics`, `insights`, `leads`, `slug`, `reserved-slugs`, `tags`, `url`, `templates`,
  `csv`. The web's 787 tests already cover them.
- **Design tokens live in one file.** CSS custom properties in `app/globals.css`, surfaced by
  `tailwind.config.ts`; Inter through `next/font` (D-014); the brand mark as a 1000 px transparent
  PNG in the git-ignored `/logo`.
- **Facts that matter later.** The database is in `eu-west-1` (Ireland). Deploys go through the
  Vercel CLI, not git pushes. Card taps already carry `?src=` attribution, and the QR endpoint
  `/api/qr/<slug>` is a public pure encoder the app can reuse.

### 2.2 Problems that change the plan

1. **Every save re-creates a profile's actions, which damages click analytics twice.**
   `savePageAction` deletes all of a page's `links` and inserts fresh rows
   (`app/dashboard/profiles/[id]/edit/actions.ts:81-101`). `events.link_id` is `ON DELETE SET NULL`
   (`0001_init.sql:63`), so each save detaches every past click from its action: "top actions"
   and Insights (D-016) quietly restart from zero. Worse, the live page is a snapshot carrying the
   *old* link ids and logs clicks with them (`components/public-profile.tsx:65`). After a draft
   save those ids no longer exist, so `log_event`'s insert should fail its foreign key — and
   `/api/track` ignores the error. Clicks on the live page would go unrecorded until the owner
   publishes again. I derived this from the code; one query confirms it before the fix. An
   autosaving editor would trigger it every few seconds. **Fix in M2, for the web too:** save by
   upserting each action by id, and make `log_event` keep an event whose link has gone (§9 W4,
   §10 `0030`).
2. **Nothing deletes an account**, and deleting an `accounts` row would also delete that
   business's `payments` and `orders` (`ON DELETE CASCADE`). Both stores require in-app deletion,
   and Play also wants a web deletion link. → §9 W7, §10 `0033`.
3. **The lead-capture gate lives only in a server action.** `savePageAction` switches the lead
   form off for accounts without a live card (`actions.ts:48-57`); the database does not enforce
   it. If the app wrote `smart_pages.config` itself it would be a second copy of that rule — and old
   app versions stay installed for months. → App writes to a profile run the same server code as
   the web.
4. **`get_leads` stops at 200 with no way to page further** (`0012_lead_workflow.sql:70-133`).
   → `0031` adds a cursor.
5. **Email sign-in has three weak spots.**
   *(a)* The magic link loses `next` (launch checklist §1b, cause unknown). My leading hypothesis:
   the dashboard template builds its link from `{{ .SiteURL }}` instead of `{{ .RedirectTo }}`,
   which drops the query string exactly as observed. Unverified — the template lives only in the
   dashboard.
   *(b)* Corporate mail scanners often open links before a person does, which uses up the one-time
   token — and the 6-digit code in the same email almost certainly dies with it, because both come
   from one token (verify in M1).
   *(c)* Volume: Supabase allows 30 auth emails an hour project-wide, and Resend's free plan stops at
   100 emails a day. A launch-day wave of app sign-ins would hit both.
6. **The web build would swallow `/mobile`.** The root `tsconfig.json` includes `**/*.ts`,
   `eslint .` lints everything, and Vitest runs every `**/*.test.ts(x)`. Adding the app folder
   without excludes breaks `next build`'s type check. → §5.3.
7. **The web's card-status wording is a payment prompt.** `IDENTITY_STATE_META` says "renew to
   avoid interruption" and "Renew to bring it back" (`lib/identity.ts:206-236`). Store rules forbid
   that inside the app. → The app has its own wording (§3).
8. **The privacy policy is behind.** `/privacy` names Supabase, Vercel and M-Pesa only. Resend has
   carried lead details since August, and nothing covers retention periods, account deletion, or
   storage outside Kenya (Ireland). The app adds Expo, Apple/Google push and Sentry. → M6.
9. **Smaller things, noted and mostly left alone.** Sign-up accepts 6-character passwords while
   reset needs 8 (`login-form.tsx:378`, `reset-form.tsx:10`). The web editor's "Unpublished changes"
   warning disappears after saving although the changes still are not live (the app needs a shared
   draft-vs-live helper, which fixes this too). Replaced images are never deleted from storage.
   `/api/lead` and `/api/track` use the Edge runtime, which Vercel now deprecates.

### 2.3 RLS and index audit — every table the app touches

| Table / function | App use | Rows | Columns | Hot-query index | Verdict |
|---|---|---|---|---|---|
| `accounts` | read name | select own (0001) | update `name, profile, notify` (0014) | PK | OK |
| `profiles` | read `account_id` | select self | — | PK | OK |
| `smart_pages` | read; write via route; publish via RPC | all own | insert/update column grants (0019); `status` only via RPC | `account_id` | OK |
| `links` | read; write via route | all own | table-wide (no column grants) | `smart_page_id` | OK — writes go through the route; the public page re-derives every href at render (`profile-view.tsx:180`), so a stored value cannot become a script |
| `leads` | list via RPC; update; delete | select/update/delete own | update `status, note, updated_at` (0012) | `(smart_page_id, created_at desc)`, `(smart_page_id, status, created_at desc)` | OK; add cursor (0031) |
| `nfc_tags` | read; rename; RPCs | select own | update `label` only (0020) | `account_id`, `token` | OK |
| `events` | only through RPCs | select own | writes only via `log_event` | `(smart_page_id, ts)`, `(tag_id, ts desc)` | OK — RPCs read ≤ 90 days for one account |
| storage `page-assets` | upload profile photo | own folder = `account_id` (0002) | — | — | OK |
| `push_devices` (new) | register / preferences | own rows | via functions only | `user_id`, `account_id` | New in 0032 |

`get_leads` computes `repeat_count` with a subquery per row — fine at hundreds of leads per
account; revisit past ~5,000. Existing policies call `auth.uid()` un-wrapped, which is fine at this
scale and not worth touching working security for; new policies use `(select auth.uid())`, as
Supabase's advisor recommends.

---

## 3. Store payment rules — does "no purchases" still work?

**Verdict: yes. The brief's approach is compliant on both stores and is the lowest-risk option.
Keep it, with two adjustments.**

What the rules say today (27 Sep 2026):

- **Apple 3.1.3(f), Free Stand-alone Apps:** "Free apps acting as a stand-alone companion to a paid
  web based tool (i.e. VoIP, Cloud Storage, Email Services, Web Hosting) do not need to use in-app
  purchase, provided there is no purchasing inside the app, or calls to action for purchase outside
  of the app." That describes this app.
- **Apple 3.1.1(a):** outside the United States storefront, "apps **and their metadata** may not
  include buttons, external links, or other calls to action that direct customers to purchasing
  mechanisms other than in-app purchase." Metadata includes the store listing.
- **Apple 3.1.3:** "Developers can send communications outside of the app to their user base about
  purchasing methods other than in-app purchase." The renewal emails stay as they are.
- **Google Play Payments policy:** an app may not lead users to another payment method through
  "an app's listing in Google Play", "in-app promotions", "in-app webviews, buttons, links,
  messaging, advertisements, or other calls to action", or sign-up flows. Kenya is in none of
  Google's alternative-billing programmes. An app that sells nothing needs no Play billing.

**Adjustment 1 — neutral wording everywhere: in screens, notifications and both store listings.**

| Situation | Fine in the app | Not in the app |
|---|---|---|
| Card term running | "Active until 31 Dec 2026" | "Renews on…", "Renew now" |
| Ending soon | "Active until 31 Dec 2026 · 12 days left" | "Renew to avoid interruption" |
| Grace period | "Term ended 31 Dec. Still working until 14 Jan." | "Pay KES 1,000", any link |
| Lapsed | "Not active since 14 Jan" | "Renew to bring it back" |
| No slot to publish | "This profile can't go live yet. Each live profile needs its own active card." | "Buy a card", checkout |
| Unactivated card tapped | "This card hasn't been activated yet." | "Get your own TapTap card" (the web shows this) |
| Sign-in screen | "Sign in with the email you use for TapTap." | "No account? Buy a card at…" |
| Push | "'Reception card' is active until 31 Dec." | "Renew in your dashboard" |
| Store listing | what the app does | prices, "order cards at…" |

**Adjustment 2 — payment instructions travel by email only.** The T30/T7/T0 renewal emails already
do this (`0016`, `notify-renewals.ts`), and 3.1.3 explicitly allows it.

*Considered and parked:* 3.1.3(e) and Play's physical-goods exemption would allow ordering cards
in the app with M-Pesa, but the card price bundles twelve months of a digital service, which blurs
the line. Not in v1; revisit after launch with evidence.

**Other review points, not about money**

- **2.1 (completeness):** reviewers need a working demo account and a short video of the NFC flow,
  because they will not have a card (§13).
- **4.2 (minimum functionality):** the app must be more than a website in a frame — native screens
  throughout, no WebView UI.
- **5.1.1(v) (account deletion):** in-app deletion is included, even though the app never creates
  accounts.
- **3.1.1 ("own mechanisms to unlock… QR codes"):** linking a card unlocks nothing in the app; it
  points a physical object at a web page. The review notes will say so.
- **EU storefronts** require Hornbill to publish trader details (address, phone) under the Digital
  Services Act. I suggest Kenya first and the EU left off (question 13).

---

## 4. Architecture

### 4.1 Principles

1. **Read direct, write through rules.** Reads use Supabase with the user's session. Writes the
   database already polices (RPCs, column-granted fields) go direct too. Writes whose rules live
   in TypeScript go through `/api/app/v1` routes that run the *same* code as the web.
2. **Nothing secret in the app.** It ships only public values: the Supabase URL and publishable
   key, the Sentry DSN, and the site URL.
3. **Old versions stay installed for months.** Server contracts are versioned (`/api/app/v1`),
   migrations stay additive (the codebase already does "superseded, not dropped" — `0008`, `0011`),
   responses are validated at the boundary, and a minimum-version switch can retire a broken build.
4. **Cache first, network second.** Paint what is known, refresh behind it.
5. **One source of truth per rule.** Shared `lib/` modules for logic; the database where it already
   enforces.
6. **Card taps and public profile links never open the app.**

### 4.2 Shape of the system

```
┌──────────── Phone: Expo app (/mobile) ────────────┐
│ Screens (Expo Router) ─ features ─ query cache    │
│      │ reads, RPCs, safe writes     │ rule writes │
│      ▼                              ▼             │
│ supabase-js (publishable key +   fetch + Bearer   │
│   the user's own session)          access token   │
└──────┬──────────────────────────────┬─────────────┘
       │                              │
       ▼                              ▼
 Supabase (eu-west-1)          Vercel: Next.js
 · Postgres + RLS + RPCs  ◄─── · /api/app/v1/* (new, user-scoped;
 · Auth (password, email code)    service role only where required)
 · Storage (page-assets)       · existing web, /t/<token>, /<slug>
                               · push sender ─► Expo push ─► FCM / APNs ─► phone
                               · email       ─► Resend
 Sentry ◄── crash reports from the app (no personal data)
```

### 4.3 Stack — confirmed, challenged, added

| Area | Choice | Verdict |
|---|---|---|
| Framework | Expo SDK 57 (RN 0.86, React 19.2), New Architecture, Hermes | **Confirmed.** Targets Android API 36 (Play's requirement since 31 Aug 2026); minimum Android 7 and iOS 16.4 (iPhone 8 and later — every one of which reads NFC). SDK 58 entered beta on 15 Sep with a reworked Expo Router core: **decision gate on 31 Oct** — move only if 58 has been stable two weeks and NFC, Sentry and FlashList support it. No SDK upgrades between M1 and launch. |
| Language | TypeScript strict | Confirmed |
| Navigation | Expo Router (file-based), `Stack.Protected` for signed-in areas | Confirmed |
| Backend | Same Supabase project, `@supabase/supabase-js` | Confirmed |
| Session storage | AES key in SecureStore, encrypted session in AsyncStorage | **Challenged** — SecureStore's 2 KB limit (§4.4) |
| Server logic | Next.js route handlers, Bearer token, versioned `/api/app/v1` | Confirmed, with versioning added |
| Build and release | EAS Build / Submit / Update; update channels `preview` and `production`; runtime version from the native fingerprint | Confirmed. Free tier (15 Android + 15 iOS builds a month, slow queue, updates to 1,000 users) lasts until late November; Starter (US$19/month) from then. |
| NFC | `react-native-nfc-manager` v4 with its config plugin, in a dev build | **Conditional** — proven on hardware in M0; fallback in §4.6 |
| Push | `expo-notifications` + Expo push service | Confirmed |
| Crashes | `@sentry/react-native` | Confirmed — **moved to M0** |
| Lists | `@shopify/flash-list` v2 | Confirmed for the leads list; short lists use plain views |
| Images | `expo-image` | Confirmed |
| Location | `/mobile` in this repo | Confirmed — as a standalone package (§5) |

**Added — each earns its place:**

| Package | Why |
|---|---|
| `@tanstack/react-query` + persist client + AsyncStorage persister | Caching, offline queue, retries, optimistic updates, pull-to-refresh. Hand-rolling this is where offline apps get their bugs. |
| `@react-native-async-storage/async-storage` | Holds the encrypted session and the query cache — Supabase's documented storage. |
| `aes-js` + `expo-crypto` | Encrypt the session at rest (Supabase's documented pattern); `expo-crypto` is the first-party random source. |
| `i18next`, `react-i18next`, `expo-localization` | Every string through i18n with plurals; Kiswahili becomes a translation job. |
| `expo-image-picker`, `expo-image-manipulator` | Pick a photo and shrink it before upload (a 5 MB photo becomes ~150 KB). |
| `expo-file-system`, `expo-sharing` | Share the QR code as an image. |
| `expo-haptics`, `expo-network`, `expo-web-browser`, `expo-device` | Haptics; online/offline state; privacy policy in an in-app browser; phone maker for Tecno/Infinix notification help. |
| `lucide-react-native` + `react-native-svg` | The web's icon set, so both products look like one; SVG also draws the sparklines. |
| ~~`zod` (mini build)~~ → `src/api/shape.ts` | Validates every server response, so a schema change shows an error state instead of crashing an old app version. **Changed in M1 (D-045):** in Metro even `zod/mini` bundles all of zod's languages (889 KB of source), so a ~60-line local checker does the job. |
| Dev: `jest-expo`, `@testing-library/react-native`, `eslint-config-expo`, `eslint-plugin-i18next`, `prettier` | Tests, lint (including "no raw strings"), formatting. |

**Deliberately not added:** Reanimated and Gesture Handler (no drag or gesture-driven sheets in
v1; the built-in `Animated` API covers fades and slides) unless a required library pulls them in —
*M1 found that Expo Router does (its drawer's required peers), so they, and Worklets, are compiled
in regardless; they are pinned to SDK 57's versions and the app's code does not use them (D-045)*;
any UI kit (we own our components, as the web does under D-011); a bottom-sheet library;
`react-native-share` (a plain `wa.me` link reaches WhatsApp); MMKV (only if M7 measurements show
the cache restore hurting start-up); a charting library (bars are plain views).

### 4.4 Sign-in and sessions

**Flows — all native, none opens a browser:**

| Flow | Calls |
|---|---|
| Email + password | `signInWithPassword` |
| Email me a code | `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } })` → six boxes (with `oneTimeCode` autofill, so iOS can offer the code from Mail) → `verifyOtp({ email, token, type: "email" })` |
| Forgot password | `resetPasswordForEmail(email, { redirectTo })` → code → `verifyOtp({ email, token, type: "recovery" })` → new password twice (minimum 8) → `updateUser({ password })` |
| Emailed link (bonus, M6) | Universal/App Link to `/auth/confirm?token_hash=…&type=…` → `verifyOtp({ token_hash, type })` |

- `shouldCreateUser: false` — the app never creates accounts. The redirect is always set to the
  website, so the link inside the email works wherever it is opened.
- **Session:** `autoRefreshToken` and `persistSession` on, `detectSessionInUrl` off; refresh starts
  when the app comes to the foreground and stops in the background (Supabase's documented React
  Native pattern).
- **Storage:** a random AES-256 key per install lives in the iOS Keychain / Android Keystore
  (through SecureStore); the encrypted session lives in AsyncStorage. Uninstalling wipes
  AsyncStorage, so a reinstall starts signed out even though iOS keeps Keychain items.
- **Sign-out:** remove this phone's push registration, `signOut()`, delete the key, clear every
  cache. A phone handed to someone else keeps nothing and receives nothing.
- **Errors** in plain English: wrong password, unknown email, expired code, too many attempts,
  offline.
- **Email template:** add the code, keep today's link exactly as it is (§11). The web magic link
  keeps working.

### 4.5 Data, caching and offline

- **Cache:** TanStack Query, persisted to AsyncStorage (throttled writes; seven-day maximum age;
  discarded on app upgrade and on sign-out).
- **Launch:** the splash screen holds only until the session and cache are restored, then the last
  known screen paints and refreshes behind the scenes.
- **Freshness:** account and profiles 30 s, cards 60 s, leads 30 s, analytics 5 min. Refresh on
  coming to the foreground and on pull-to-refresh. No polling.
- **Offline:** a banner; screens show cached data with "Updated 3 h ago". Safe edits queue and
  replay in order — lead status and note, card name, profile draft. Edits that must not be queued
  are disabled with "You're offline" — publish, link a card, switch a card off, delete.
- **Optimistic updates:** lead status and note, card name, action on/off and order — undone with a
  toast if the server refuses.
- **Every screen has four states:** skeleton → data → empty → error with retry. Requests time out at
  15 s. Reads retry twice with back-off; writes retry only when repeating them is harmless (profile
  drafts are, because the phone generates new action ids).
- **Boundary checks:** every function response is validated; a mismatch shows an error state and
  sends Sentry an event instead of crashing.
- **Customer data on the phone:** cached leads are personal data, so Android backups are off
  (`allowBackup: false`), everything is cleared on sign-out, and the privacy policy says so.

### 4.6 NFC

**What the app reads:** the chip's one NDEF URL record, written at encoding (D-031). It is accepted
only if it matches `https://taptap.hornbilltech.co.ke/t/<32 hex characters>`; anything else gets
"This isn't a TapTap card." The chip's hardware serial (UID) is not used — nothing records it, and
CLAUDE.md §18 keeps UID, token and slug distinct.

**"Set up a card" (Cards tab):**

1. An explainer sheet shows where to hold the card — the top edge of an iPhone, the middle of the
   back on most Android phones.
2. Android: if NFC is switched off, open NFC settings. If the phone has no NFC, go to the fallback.
3. Scan. Android uses reader mode while the sheet is open, so the tap does not open the browser;
   iPhone shows Apple's "Ready to Scan" sheet. A haptic confirms the read.
4. Match the token against your cards (already cached — RLS only returns yours):
   - **Yours, not pointed at a profile** → choose a published profile → `claim_tag(token, page)`,
     which itself refuses drafts and other accounts' cards.
   - **Yours, already pointed** → card detail, with "Change profile" → `rebind_tag`.
   - **Yours, switched off** → offer to switch it on → `set_tag_status`.
   - **Not yours** → `resolve_tag(token)` tells "not activated yet" from "belongs to another
     account"; a plain message, no buy link.
5. **Fallback without NFC** — common on low-cost Android phones: "Find the serial printed on the back
   of your card" → your cards not yet set up, listed by serial.

**Rules:** an in-app read never logs an analytics event — it is the owner, not a customer (§15). It
does not close the order either; the customer's first real tap still does, exactly as D-032 says.
Card taps outside the app keep opening the browser: the app never claims `/t/*` links and never
registers for NFC intents.

**iOS details:** "NFC Tag Reading" capability; `NFCReaderUsageDescription`; the entitlement's
formats list must contain only `TAG` — an `NDEF` entry makes App Store Connect reject the upload
(ITMS-90778), a known trap with this library's older defaults.

**Library decision in M0:** try v4 on the New Architecture first. v3 might run through React
Native's compatibility layer, but that is not something to bet a never-cut feature on. If v4
misbehaves on either phone, the fallback is a local Expo module (Kotlin `enableReaderMode`, Swift
`NFCNDEFReaderSession`) exposing the same `readTapTapUrl()` call, so no screen changes.

### 4.7 Push notifications

- **Asking:** a card on Home ("Get told the moment a customer leaves their details") opens an
  explainer; the operating system's prompt only follows "Turn on". Refusing is respected, with a
  link to settings.
- **Registration:** the Expo push token is stored through `register_push_device()` — one row per
  phone, owned by the user, with the account set by the database, never by the app. It is refreshed
  on each launch, removed on sign-out, and pruned when Expo reports the device gone.
- **Sending:** from the web server through Expo's push API, with Expo's access token turned on so
  nobody else can push to our users.

| Event | Triggered today in | Notification | Opens |
|---|---|---|---|
| New lead | `/api/lead` → `after()` → `notifyNewLead` | "New lead · Someone left their details on {profile}." | the lead |
| First tap of a dispatched card | `/t/<token>` → `after()` → `handleFirstTap` (D-032) | "Your card is live · {card} was tapped for the first time." | the card |
| Card term ending (T30, T7, T0, lapsed) | daily cron `/api/cron/renewals` | "'{card}' is active until 31 Dec." / "'{card}' is no longer active." | Account → cards |

- **Once only:** recorded in `notification_deliveries` with channel `push`, the same claim-before-send
  idempotency email already uses. The tap path is untouched: the send runs inside the existing
  `after()`, after the redirect has gone.
- **Controls:** Android channels (Leads, Cards, Account) plus in-app switches per type.
- **Privacy:** no names, numbers or messages in the notification text — it passes through Apple and
  Google. The app fetches details after it opens (Kenya DPA data minimisation).
- **Tecno / HiOS:** tested on the Camon with the app swiped away and battery saver on. If HiOS blocks
  delivery, a help screen for Tecno, Infinix and itel phones (detected on the device) walks through
  the two settings that fix it. Lead notifications go at high priority.

### 4.8 Design system

- **Tokens** are copied from `app/globals.css` into `mobile/src/theme/tokens.ts`, and a test reads
  `globals.css` and fails if a light-mode value drifts. The dark palette is new, built from the web's
  own inverse surfaces (`#141414`, `#1F1F1F`, `#FAFAFA`, `#A3A3A3`), with orange text lifted to
  `#FB923C`. A contrast test checks every text/background pair: 4.5:1 for body text, 3:1 for large
  text and icons.
- **D-012 carries over:** `#F97316` only for fills without text; `#C2560A` behind white labels; in
  dark mode, orange buttons carry near-black text (6.7:1).
- **Measured in M0 (D-041):** `#C2560A` is 4.54:1 on white but 4.38:1 on the `#FBFBFA` page
  background, so orange *text* uses `#9A4508`. Red text uses a `dangerText` role (`#B91C1C`)
  because the web's red is 4.41:1 on its own badge fill. Muted grey never sits on the sunken grey
  (4.35:1). Vivid orange is 2.8:1 on white, so it is decoration only; states a person must see use
  `accentFill`.
- **Type:** Inter 400/500/600/700, embedded at build time (no loading flash), using the web's roles —
  page title 24/32, section 18/28, card title 15/22, body 15/24, small 14/22, caption 12/18, metric
  30/36 — with tabular figures for numbers. System font scaling is honoured; tab labels cap at 1.3×.
- **Spacing** on a 4-point grid; radii 6/8/12/16/20; the web's soft shadows translated.
- **Components (M0–M1):** Text, Button (primary, secondary, ghost, danger, loading), IconButton,
  TextField, CodeField, Switch, SegmentedControl, Card, ListRow, Badge, Sheet, ConfirmSheet, Toast,
  Skeleton, EmptyState, ErrorState, OfflineBanner, SaveState, Screen (safe areas and pull-to-refresh),
  Avatar, MetricTile, BarChart.
- **Interaction:** every tap target at least 48 dp; one primary action per screen; toasts instead of
  alerts; confirmations as sheets; haptics on publish, card read, lead status change and destructive
  confirmations.
- **Motion:** 120 / 180 / 240 ms with the web's easing; fades and slides only; off when the phone's
  reduce-motion setting is on.
- **Accessibility:** every control carries a label, role and state; focus order checked with TalkBack
  and VoiceOver; status never shown by colour alone; WCAG 2.2 AA.
- **Brand:** the app icon and splash come from the hornbill mark. The Android adaptive icon keeps
  padding so the beak survives the circle mask — the lesson the web's maskable icon already learned.

### 4.9 Strings, ready for Kiswahili

English resources in `mobile/src/i18n/en/*.json` with typed keys. A lint rule fails on any text
written directly in a screen, including accessibility labels. Plurals through i18next; dates and
money through `Intl` with `en-KE` ("31 Dec 2026", "KES 1,000"). Adding Kiswahili later means one
`sw` folder and a translator. Copy stays short, plain and in the second person.

### 4.10 Performance budgets

| Measure | Budget | Measured by |
|---|---|---|
| Cold start to a usable Home (cached) | ≤ 3.0 s on the low-end emulator profile; ≤ 1.5 s on the Camon | `adb shell am start -W`, median of 5, plus Sentry's app-start timing |
| Android download size | ≤ 25 MB | Play Console |
| JavaScript bundle (Hermes bytecode) | ≤ 7 MB at launch — M0 baseline 4.4 MB (Expo Router, Sentry, i18n, NFC); **M1 5.24 MB** (+ Supabase, TanStack Query, SVG icons, sign-in and shell); **M2 5.72 MB** (+ Home, editor, share, QR encoder, photo picker and clipboard modules); **M3 5.79 MB** (+ leads, analytics). M1 briefly measured 7.9 MB before the fixes in D-045 | `npx expo export --platform android` |
| Leads list | no blank rows scrolling 500 leads on the low-end profile | manual + performance monitor |
| Profile photo upload | ≤ 300 KB after compression | unit test on the resize step |

How: Hermes; modules loaded on first use; nothing awaited before first paint except the session and
cache; fonts embedded; R8 shrinking on release builds; the short dependency list above. **Low-end
profile:** Android 11 emulator image, 2 GB RAM, 2 cores, "Don't keep activities" on, network
throttled to 3G/EDGE.

### 4.11 Security and privacy

- **Secrets:** the service role key, Expo access token and Resend key stay in Vercel; signing keys,
  the Sentry auth token and store API keys stay in EAS. The repo is public, so the existing pre-commit
  secret scan extends to `mobile/`, and nothing credential-shaped is committed.
- **Routes:** the Bearer token is checked with `supabase.auth.getUser(token)` — a server-side check,
  so revoked sessions fail — and queries then run as that user under RLS. No CORS is needed (the
  caller is not a browser). Account deletion additionally requires a sign-in within the last ten
  minutes.
- **Links into the app:** only our domain and the allow-listed paths are handled. The `next` of an
  emailed link is mapped through a fixed table of app screens, never followed as a URL — the web's
  `safeNext` rule, applied natively.
- **Sentry:** `sendDefaultPii: false`; emails, phone numbers and tokens scrubbed from messages and
  breadcrumbs; the user id is attached, never the email.
- **Kenya Data Protection Act 2019:** processors named in the privacy policy, push kept free of
  personal data, device caches cleared on sign-out, Android backup off, retention stated, deletion
  in the app and on the web. ODPC registration remains the open launch-checklist item.

---

## 5. Repository layout — and proof it won't break Vercel

### 5.1 Layout

```
taptap/                          repo root = the web app, unchanged
├─ app/  components/  …          web, as today
├─ lib/                          15 pure modules the app imports read-only
├─ mobile/                       NEW — standalone Expo package
│  ├─ app.config.ts              name, IDs, plugins; development / preview / production variants
│  ├─ eas.json                   build, submit and update profiles
│  ├─ package.json, package-lock.json
│  ├─ metro.config.js            watches ../lib; resolves packages only from mobile/node_modules
│  ├─ tsconfig.json              strict; @/* → src/*, @taptap/core/* → ../lib/*
│  ├─ app/                       screens (Expo Router — one thin file per route)
│  ├─ src/
│  │  ├─ api/                    Supabase client, query keys, function wrappers, response checks
│  │  ├─ auth/                   session provider, encrypted storage
│  │  ├─ features/               home, editor, leads, analytics, cards, nfc, account, push, share
│  │  ├─ ui/                     design-system components
│  │  ├─ theme/                  tokens (light, dark), typography
│  │  ├─ i18n/                   setup + en/*.json
│  │  └─ lib/                    app-only pure helpers
│  ├─ assets/                    icon, splash, Inter, store badges
│  ├─ e2e/                       Maestro flows
│  └─ modules/                   only if the NFC fallback module is needed
├─ .vercelignore                 NEW — keeps mobile/ out of Vercel uploads
└─ docs/mobile/                  BRIEF, PLAN, PROGRESS
```

Bundle ID `ke.co.hornbilltech.taptap` for preview and production builds, and
`ke.co.hornbilltech.taptap.dev` for development builds, so both can sit on one phone.

### 5.2 Why a standalone package rather than a monorepo workspace

- **Least disruption.** npm workspaces would hoist the app's native dependencies into the root
  install, so every Vercel build would download React Native. A pnpm/Turborepo restructure would
  move the web into `apps/web` — a new Vercel root directory, new import paths and a riskier deploy —
  for no gain to a one-person team.
- **Sharing without moving files.** The app reads `lib/` through the `@taptap/core` alias. Metro
  watches `../lib` but resolves packages only from `mobile/node_modules`, and the allow-listed files
  import no packages at all. A web test (`lib/mobile-shared.test.ts`) fails if one of them gains a
  package import or a server-only API. New logic both sides need — Kenyan phone parsing, the
  draft-vs-live comparison — is written in `lib/` with web tests, then allow-listed.
- **EAS builds from the subfolder.** EAS uploads the git tree and, because the root declares no
  workspaces, installs only `mobile/`'s packages (verified from the first build log in M0).

### 5.3 What would break without guards

| Tool | Today | Without a guard | Guard (M0) |
|---|---|---|---|
| `next build` type check, `npm run typecheck` | `tsconfig.json` includes `**/*.ts`, `**/*.tsx` | type-checks React Native files against web types → **build fails** | add `"mobile"` to `exclude` |
| `npm run lint` | `eslint .` | lints the app with web rules | add `mobile/**` to ignores |
| `npm test` | Vitest includes `**/*.test.{ts,tsx}`; excludes only `node_modules`, `.next` | runs app tests under jsdom, and crawls `mobile/node_modules` | add `mobile/**` to exclude |
| Tailwind | content is `./app/**`, `./components/**` | unaffected | none |
| Vercel CLI upload | no `.vercelignore` | uploads the app's source and assets | `.vercelignore` with `mobile/` |
| Vercel install and build | root `package-lock.json` | unaffected — `mobile/` is not a workspace | none |

### 5.4 How M0 proves it

1. With `/mobile` scaffolded **and its `node_modules` installed** (the worst case): `npm run
   typecheck`, `npm run lint`, `npm test` (787 passing) and `npm run build` at the root — all green,
   matching today's baseline.
2. With your go-ahead: a **preview** deployment (not production) of this branch. Check the upload
   excludes `mobile/`, and smoke-test `/`, `/login`, a real `/t/<token>` and a real `/<slug>`.
3. The shared files compile under both the web's and the app's type checks, and the guard test
   passes.

---

## 6. V1 scope

**In v1**

- **Onboarding:** up to three screens, shown once, skippable.
- **Sign-in:** password, email code, reset by code; emailed links open the app (M6, bonus).
- **Home:** the live profile as customers see it (rendered natively), its status (Live / Draft /
  Unpublished changes / Inactive), **Share** (WhatsApp first), full-screen QR, this week's numbers.
- **Profile editor:** photo, name, tagline, bio; contact card; actions (add, edit, on/off, move,
  delete); look (theme and accent); lead form on/off where the account has it; draft saved
  automatically; Publish / Unpublish; full-screen preview.
- **Leads:** list, status filter with counts, search within what's loaded, detail with call /
  WhatsApp / email, status and note, earlier enquiries, delete, a badge for new ones.
- **Analytics:** 7 / 30 / 90 days, all profiles or one; reach, clicks, saves, leads with change vs
  the previous period; daily chart; how people arrived; top actions (labelled clicks, not results);
  per card; busiest hours.
- **Cards:** list and detail — name, serial, profile, switch off/on, term status (neutral),
  30-day taps; **set up a card by NFC** on Android and iPhone, with a no-NFC fallback.
- **Account:** business, card terms (neutral), notification settings, help (WhatsApp and email),
  privacy, terms, sign out, **delete account**.
- **Push:** new lead, first tap, term ending.
- **Throughout:** offline cache, pull-to-refresh, skeletons, error and retry, toasts, haptics, light
  and dark, font scaling, screen readers, Sentry, over-the-air updates, a minimum-version switch.

**Not in v1 — and why**

| Left out | Why |
|---|---|
| Buying, renewing, checkout, orders, replacement cards, Premium proof approval | Store payment rules (§3); these stay on the web |
| Creating or deleting profiles, changing a slug, SEO fields, switching page ↔ redirect, templates | Rare set-up tasks; card owners already have a profile (D-021 means they built one before buying) |
| CSV exports | The web does it; v1.1 candidate |
| Insights card | The shared `computeInsights` makes it cheap later; v1.1 candidate |
| Drag-to-reorder | Move up/down covers it accessibly (§0 #8) |
| Team members, Google sign-in, Kiswahili, iPad layout | D-017 deferral; brief; strings are ready; iPhone-only halves the screenshot work |

---

## 7. Screens and navigation

### 7.1 Routes

```
mobile/app/
├─ _layout.tsx                    providers, splash, signed-in guard
├─ +native-intent.tsx             maps incoming https links to screens (allow-list only)
├─ welcome.tsx                    onboarding (≤ 3 pages, once)
├─ sign-in.tsx                    email + password · "Email me a code" · "Forgot password?"
├─ sign-in-code.tsx               enter the 6-digit code
├─ forgot-password.tsx            code, then new password
├─ auth/confirm.tsx               an emailed link opened in the app (M6)
└─ (app)/                         signed-in only
   ├─ (tabs)/
   │  ├─ index.tsx                Home
   │  ├─ leads.tsx                Leads
   │  ├─ analytics.tsx            Analytics
   │  ├─ cards.tsx                Cards
   │  └─ account.tsx              Account
   ├─ lead/[id].tsx               lead detail
   ├─ card/[id].tsx               card detail
   ├─ card/set-up.tsx             NFC set-up (modal)
   ├─ profile/[id]/edit.tsx       editor
   ├─ profile/[id]/action.tsx     add or edit one action (sheet)
   ├─ profile/[id]/preview.tsx    full-screen draft preview
   ├─ share/[id].tsx              share sheet (WhatsApp first)
   ├─ qr/[id].tsx                 full-screen QR
   ├─ settings/notifications.tsx
   └─ settings/delete-account.tsx
```

### 7.2 Navigation map

Tab bar: **Home · Leads · Analytics · Cards · Account** — five, the brief's maximum. (The web calls
leads "Customers"; the app follows the brief. Worth aligning the two later.)

```
First launch ─► Welcome (≤3) ─► Sign in ─┬─ password ─────────────────┐
                                          ├─ email code ─► Code ──────┤
                                          └─ forgot ─► Code + new password
                                                                      ▼
┌─────────────────────────────── Tabs ──────────────────────────────────────┐
│ Home ─► Share · QR · Edit profile ─► Action · Preview ─► Publish           │
│ Leads ─► Lead (call · WhatsApp · email · status · note · delete)           │
│ Analytics (range · profile)                                                │
│ Cards ─► Card (name · profile · on/off) · Set up a card (NFC or serial)    │
│ Account ─► Notifications · Help · Privacy · Terms · Sign out · Delete      │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Web links that open the app — an allow-list

| Link | Opens |
|---|---|
| `/dashboard` | Home |
| `/dashboard/customers` (in every lead email) | Leads |
| `/dashboard/analytics` (in the first-tap email) | Analytics |
| `/dashboard/devices` | Cards |
| `/dashboard/profiles`, `/dashboard/profiles/<id>/edit` | Home, editor |
| `/dashboard/profiles/<id>/analytics`, `…/leads` | Analytics or Leads for that profile |
| `/dashboard/settings` | Account |
| `/login` | Sign in (or Home if already signed in) |
| `/auth/confirm?token_hash=…` (if W8 is approved) | signs in, then the mapped screen |

**Never the app:** `/t/*` (card taps), `/<slug>` (profiles), `/dashboard/billing`,
`/dashboard/checkout`, `/dashboard/orders` — payment stays on the web, so the renewal email's billing
link must keep opening the browser — `/admin/*`, `/print/*`, and everything else. Both platforms use
an explicit list rather than `/dashboard/*` with exceptions, because Android's link filters cannot
express exceptions before Android 15.

### 7.4 Notification → screen

New lead → that lead · first tap → that card · term ending → Account, cards section.

---

## 8. Data and API contract per screen

**Key:** **T** = table read or write under RLS · **F** = Postgres function (RPC) · **API** = new
Next.js route with a Bearer token.

**Shared queries** (used by several screens)

| Name | Source | Used for | Fresh for |
|---|---|---|---|
| `me` | session; T `profiles(account_id)`; T `accounts(name)` | user, account, business name | 5 min |
| `pages` | T `smart_pages` — `id, slug, title, mode, redirect_url, config, theme, status, published_at, published_content, updated_at, created_at, entitlement_grandfathered` | the account's profiles (at most 25) | 30 s |
| `cards` | T `nfc_tags` — `id, token, kind, label, status, smart_page_id, term_start, term_end, claimed_at, serial, variant` | card states (`identityState`), page live state (`publicPageState`), publish slots (`canPublishPage`), term summary (`billingSummary`) | 60 s |

**Per screen**

| Screen | Reads | Writes | Offline |
|---|---|---|---|
| **Home** | `me`, `pages`, `cards`; F `get_dashboard_overview(p_days 7)`; QR image `GET /api/qr/<slug>?size=768` (existing, public, cached on the phone) | — (sharing and QR are local) | all from cache |
| **Editor** | the page from `pages`; T `links(id, type, label, value, sort_order, is_active)` | **API** `PUT /api/app/v1/pages/{id}/draft`, body `{ expectedUpdatedAt, title, config, theme, redirectUrl?, blocks: [{ id, type, label, value, isActive }] }` in display order → `200 { updatedAt }` · `409 { code: "conflict", updatedAt }` · `422 { code: "invalid_destination", index }` · `401`. F `publish_page(p_page_id)`, F `unpublish_page(p_page_id)`. Photo: Storage `page-assets/<account_id>/<page_id>/avatar-<time>.jpg` (the web's path; RLS limits writes to the account's folder) | edits kept and saved on reconnect; publish disabled |
| **Leads** | F `get_leads(p_days 3650, p_page_id?, p_status?, p_limit 30, p_before_created_at?, p_before_id?)` (cursor added by 0031); F `get_lead_counts(p_days 3650, p_page_id?)` | T `leads.update({ status, note, updated_at })` (the only writable columns, 0012); T `leads.delete()` | cached pages; status and note queued; delete disabled |
| **Lead** | from the list cache | call `tel:`, WhatsApp `https://wa.me/<number>` (shared `whatsappNumber` / `toInternational`), `mailto:` | from cache |
| **Analytics** | F `get_analytics(p_days 7 / 30 / 90, p_page_id?)`; full or basic view from the live card count (`entitlementsFor`) | — | last result per range and profile |
| **Cards** | `cards`; F `get_devices_overview(p_days 30)` for taps and last tap | T `nfc_tags.update({ label })` (the only writable column, 0020); F `rebind_tag(p_tag_id, p_page_id)`; F `set_tag_status(p_tag_id, "assigned" \| "disabled")` | rename queued; the rest disabled |
| **Set up a card** | NFC → token; `cards` cache; F `resolve_tag(p_token)` only for a card that isn't yours | F `claim_tag(p_token, p_page_id)` | disabled, with a message |
| **Account** | `me`, `cards` (terms shown neutrally); this phone's `push_devices` row | F `set_push_prefs(…)`; sign-out → F `unregister_push_device(token)` then `auth.signOut()`; **API** `POST /api/app/v1/account/delete` → `202` (needs a sign-in within 10 min) | sign-out works offline; the rest disabled |
| **Push registration** | — | F `register_push_device(p_token, p_platform, p_app_version, p_locale)` — the user comes from the session, the account from the database | retried next launch |
| **App start** (M7) | T `app_config` (minimum build per platform, optional notice) — readable without signing in | — | last known value |

**Errors** go through one mapper. The machine codes the web already treats as stable
(`insufficient_entitlement`, `page_not_published`, `tag_not_activated`) map to the neutral wording
in §3.

---

## 9. Changes to the Next.js app

None of these is made without your go-ahead. **Public** marks changes to public routes or public
API surface, which the brief reserves for your approval.

| # | Change | Where | When | Public |
|---|---|---|---|---|
| W1 | Keep `/mobile` out of the web build | `tsconfig.json` exclude, `eslint.config.mjs` ignores, `vitest.config.ts` exclude, new `.vercelignore` | M0 | no |
| W2 | Guard test for the shared modules | `lib/mobile-shared.test.ts` | M0 | no |
| W3 | Bearer helper: validate the token, return a user-scoped client | `lib/api/request-user.ts` (+ tests) | M2 | no |
| W4 | **Link-id fix:** one draft-save function, used by the web's Save *and* the app — validates, applies the lead-form rule, updates the page if `updated_at` still matches, upserts actions by id (ids generated by the client on both sides), deletes only removed actions | `lib/page-draft.ts` (+ tests); `savePageAction` calls it | M2 | no — but changes web behaviour |
| W5 | App draft route | `app/api/app/v1/pages/[id]/draft/route.ts` | M2 | **yes** (API) |
| W6 | Shared helpers both sides need: Kenyan phone parsing (07…, 01…, +254…); draft-vs-live comparison (also fixes the web's vanishing "Unpublished changes") | `lib/phone.ts`, `lib/page-diff.ts` | M1–M2 | no |
| W7 | Account deletion — service logic, app route, web page | `lib/account-deletion.ts`; `app/api/app/v1/account/delete/route.ts` (M4); `app/account/delete/page.tsx` (M6) | M4, M6 | **yes** |
| W8 | *(optional)* Emailed links land on `/auth/confirm`, which shows a "Continue" button before using the token — safe from mail scanners, keeps `next`, and the app can open it | `app/auth/confirm/page.tsx` + action; `/auth/callback` stays for Google | M1 | **yes** |
| W9 | Push sender (Expo API) wired into lead, first-tap and renewal notifications | `lib/notifications/push.ts`; calls added beside `notifyNewLead`, `notifyFirstTap`, `notify-renewals` | M5 | no — but touches the tap path's `after()` |
| W10 | Universal Links / App Links files | `app/.well-known/apple-app-site-association/route.ts`, `app/.well-known/assetlinks.json/route.ts` | M6 | **yes** |
| W11 | Download banners: the iOS Smart App Banner (Next's `itunes` metadata) and a dismissible Android banner — on `/` and `/dashboard` only; a test proves neither reaches `/<slug>` or `/t/<token>` | `app/page.tsx`, `app/dashboard/layout.tsx`, `components/app-banner/*` | M6 | **yes** |
| W12 | `/app` page — store badges and a QR for desktop visitors. `app` is already in `RESERVED_SLUGS`; a read-only query first confirms no profile created before the reservation owns it, because a real route would silently shadow it | `app/app/page.tsx` | M6 | **yes** |
| W13 | Privacy policy — processors (Resend, Expo, Apple/Google push, Sentry), app data, retention, deletion, storage in Ireland | `app/privacy/page.tsx` | M6 | **yes** |
| W14 | *(optional)* CI — web and mobile checks on every push; free for public repos | `.github/workflows/checks.yml` | M0 | no |

---

## 10. Database migrations — I write them, you apply them

| # | File | When | What it does |
|---|---|---|---|
| 0030 | `0030_page_draft_and_click_attribution.sql` | M2 | `save_page_draft()`: one transaction, `SECURITY INVOKER`, actions upserted by id, a stale `updated_at` refused (409). `updated_at` moves only with the draft. `log_event` keeps an event whose link no longer exists — or belongs to another page — by recording it without a link, instead of failing. Never lose a click (D-046). |
| 0031 | `0031_leads_cursor.sql` | M3 | `get_leads` gains a `(created_at, id)` cursor and caps each page at **5,000** (not 200: the CSV export asks for 5,000 in one call); dropped and re-created in one transaction so PostgREST sees a single signature. The web's calls keep working unchanged. |
| 0032 | `0032_push_devices.sql` | M3 | `push_devices` (one row per phone; per-type preferences), readable by its owner only; written through `register_push_device`, `unregister_push_device` and `set_push_prefs`, which take the user from the session and the account from `profiles`; `push_targets()` for the server only. |
| 0033 | `0033_account_deletion.sql` | M4 | `account_deletions` audit table and a service-role-only `delete_account(p_user_id)`. If other members remain, it removes just this member. Otherwise it deletes profiles (links, events and leads cascade), dismissals, push devices and quote requests; switches the cards off and detaches them; renames and empties the account; **keeps payments, orders and payment links**. |
| 0034 | `0034_app_config.sql` | M7 | One-row `app_config`: minimum build per platform and an optional notice; readable by anyone; edited in the dashboard. |

Each one ships the way this codebase already does it: a Vitest that asserts on the migration text
(grants, `security definer`, revokes from `anon`), plus a short SQL check for you to run afterwards.
Apply with `supabase db push --dry-run` first, then `supabase db push` — never `supabase config push`.

---

## 11. Supabase dashboard changes — you make them

1. **Authentication → Emails → Templates → Magic Link:** add the code block below and leave the
   existing link untouched.
2. **Same → Reset Password:** add the same block.
3. **Authentication → Rate Limits:** raise "emails sent per hour" from 30 to 150 — after upgrading
   Resend (§12).
4. **Authentication → Sign In / Providers → Email:** confirm the email code length is **6** and the
   expiry is **3600 s**; set the minimum password length to **8** (the reset form already requires 8);
   turn on leaked-password protection if your plan includes it. *Read from the live config on
   9 Oct (dry-run pull): the code length is **8** and the minimum password **6** — both need
   changing; the expiry is already 3600.*
5. **Authentication → URL Configuration:** no change. `https://taptap.hornbilltech.co.ke/**`
   already covers `/auth/confirm`.
6. **Authentication → Emails → SMTP:** confirm it is still Resend (verified 20 Sep).
7. **W8 approved (9 Oct):** change the templates' link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`
   (`type=recovery` for reset). *Revised from the first draft*, which appended to
   `{{ .RedirectTo }}`: that breaks the day Supabase hands the template a redirect without a query
   string (D-043). Exact steps and full template text: PROGRESS.md, M1. Test the web's magic link
   before and after; if the `{{ .SiteURL }}` hypothesis (§2.2 #5) is right, this also fixes the
   lost `next`.
8. **Database:** apply `0030`–`0034` as each milestone needs them.

Code block for both templates:

```html
<p>Your TapTap code:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:8px 0">{{ .Token }}</p>
<p>Enter it in the TapTap app. It works once and expires in 60 minutes.</p>
```

---

## 12. Accounts, devices and costs — yours to own

| Item | Why | Cost | Lead time | By |
|---|---|---|---|---|
| **D-U-N-S number** for Hornbill Technologies Limited | Apple and Google both require one for organisation accounts | free | up to ~30 days for a new number | **request this week** |
| **Apple Developer Program — Organization** | App Store, iPhone dev builds with NFC, TestFlight | US$99 / year | after D-U-N-S; a verification call; days to 2 weeks | mid-Oct |
| **Google Play Console — Organization** | Play Store; exempt from the 12-tester rule | US$25 once | identity + organisation checks; days to 2 weeks | mid-Oct |
| Expo account + organisation | EAS builds, updates, push | free now; Starter US$19 / month from late Nov | minutes | this week |
| Firebase project | Android push delivery | free | minutes | Oct |
| Sentry organisation | crash reports | free (5,000 errors / month) | minutes | M0 |
| **Resend Pro** | the free plan stops at 100 emails a day | US$20 / month | minutes | before the first beta |
| Test kit | the Camon (NFC on), an iPhone (iOS 16.4+), one card on your account, one card on a second test account, one non-TapTap NFC tag | — | — | M0 |

The enrolling person must be able to sign for the company. Apple also wants a company website on its
own domain and prefers a company email (`@hornbilltech.co.ke`). **New running costs: about US$39 a
month from December, plus US$99 a year and US$25 once.**

---

## 13. Reviewer demo account

Apple and Google test with a real sign-in, and neither reviewer will hold a TapTap card.

- A production account "App Review — Hornbill", `appreview@hornbilltech.co.ke`, with a strong
  password. It is created by a small script you run locally with the service key (idempotent;
  `scripts/create-review-account.mjs`), because a password user cannot be made safely in SQL.
- Contents, all fictional and clearly labelled: one published profile ("Mama Njeri's Café") with
  typical actions; about 25 leads; roughly 60 days of sample events; one identity with a term, so the
  profile can be live (D-021); one card record whose token is never printed.
- Review notes: what the app is (a free companion for TapTap card owners); that accounts and cards
  are provided by Hornbill directly to businesses; the credentials; a 30-second video of setting up
  a card by NFC.
- The data never mixes with real reporting — it lives on one labelled account.

---

## 14. Testing and quality gates

- **Every change:** in `mobile/` — `lint`, `typecheck`, `jest`; at the root — `lint`, `typecheck`,
  `test`, `build`.
- **Unit tests (app):** encrypted session storage, token parsing from NFC, link mapping
  (`+native-intent`), notification routing, draft/offline queue, Kenyan phone parsing, neutral status
  wording, i18n completeness, token parity with `globals.css`, contrast pairs.
- **Unit and integration tests (web):** Bearer helper, draft save — including "ids survive a save" —
  deletion logic, the links files ("`/t/` and slugs are never claimed"), banner placement, and
  migration-text tests in the existing `publish-enforcement` style.
- **End-to-end (Maestro):** sign in; edit and publish; share; set up a card through a test hook that
  exists only in development and preview builds. Android runs locally on Windows; iOS runs on EAS
  Workflows (its Maestro job is in alpha) or from a written manual script.
- **On real phones, every milestone:** the Camon, the iPhone, the low-end emulator profile — with a
  written script and a "done means" list.
- **Accessibility:** a TalkBack and VoiceOver walkthrough of every screen; the largest font size;
  automated contrast checks.
- **Performance:** the §4.10 budgets measured in M0 (baseline) and M7 (gate).
- **Release:** Sentry release with source maps for both builds and OTA updates; an OTA rollback
  rehearsed once.

---

## 15. Milestones

Dates follow the brief. ⚠ marks a slip I can already see.

### M0 — Plan and setup (by Sat 31 Oct)

- **I build:** the Expo app in `/mobile` (SDK 57); W1 and W2; tokens (light and dark) with parity and
  contrast tests; first design-system pieces; i18n scaffold; Sentry; `eas.json` and app variants; a
  development-only NFC test screen; PROGRESS.md; decisions recorded.
- **You do (about 3–4 hours, spread out):** approve the plan and answer questions 1–5; request the
  D-U-N-S number, then enrol with Apple and Google; create the Expo, Sentry and Firebase accounts;
  switch on Developer options and NFC on the Camon; approve each EAS build.
- **Done means:**
  - [ ] Root `typecheck`, `lint`, `test` (787) and `build` green with `/mobile` present and installed.
  - [ ] Preview deployment (with your OK) excludes `mobile/`; `/`, `/login`, a real card and a real
        slug all work.
  - [ ] `mobile/` lint, typecheck and tests green; the no-raw-strings rule active.
  - [ ] Dev build on the Camon, following the phone's light or dark theme; token and contrast tests
        pass; first cold-start measurement recorded.
  - [ ] **NFC spike:** holding a real TapTap card to the Camon shows its token; the library version
        is recorded. The iPhone spike follows as soon as the Apple account is active.
  - [ ] Sentry shows a test crash from the dev build with a readable stack trace.
  - [ ] SDK 57 vs 58 decision recorded.
- ⚠ If Apple enrolment is not done by about **20 Nov**, iPhone NFC testing (M4) and TestFlight (M7) slip.

### M1 — Sign-in and shell (Mon 2 – Fri 6 Nov)

- Sign in with password, with a code, and reset by code; sign out. The session survives killing the
  app and restarting the phone; an expired session returns to sign-in with a message.
- Onboarding once (≤ 3 screens); five tabs (placeholder content until M2–M4); Account with sign out.
- Offline: after one sign-in, launching in airplane mode shows the shell from cache with the offline
  banner; the sign-in screen explains when it is offline.
- All strings from `en` resources, enforced by lint. TalkBack and VoiceOver read every control; the
  largest font size does not clip sign-in.
- The template change (§11) is made and the web magic link still works. W8 is done if approved.

### M2 — Profile, share and QR (Mon 9 – Fri 13 Nov)

- Home shows the live profile and its status within a second from cache.
- Edit photo, name, tagline, bio, contact card, actions and look. "Saving… → Saved ✓" is shown; edits
  made offline save on reconnect; an edit made meanwhile on the web is detected, not overwritten.
- Publish → the public page shows the change immediately (checked on a second phone). Photo uploads
  stay under 300 KB and appear on the public page.
- Share opens WhatsApp with the link filled in; "More" opens the system share sheet; "Copy link"
  shows a toast. The full-screen QR scans from another phone at 1 m in normal light.
- **Link-id fix live** (W4, `0030`): saving keeps action ids (tested), and clicks on the live page
  are still recorded after a draft save (checked by hand). Web tests green; deployed with your OK.

### M3 — Leads and analytics (Mon 16 – Fri 20 Nov)

- Leads: 500 sample leads scroll without blank rows on the low-end profile. Filters with counts,
  pull-to-refresh, paging, detail with call, WhatsApp and email. Status and note change instantly and
  survive offline → online. Delete with confirmation; badge for new leads.
- Analytics: 7 / 30 / 90 days and per-profile scope; numbers identical to the web for the same
  account and range; charts respect reduce-motion.
- `0031` and `0032` applied after a dry run. Push device registration works — pulled forward from M5.

### M4 — Cards and NFC (Mon 23 – Fri 27 Nov)

- Cards list: name, serial, profile, neutral status, taps in 30 days. Rename, change profile and
  switch off/on all show up on a real tap within seconds.
- **NFC on the Camon and on the iPhone:** tap a card → the right card is identified → link it to a
  profile → a second phone tapping the card opens that profile.
- A non-TapTap tag, another account's card, NFC switched off, and a phone without NFC each get their
  own clear outcome; the serial fallback works.
- In-app reads never create analytics events (counted before and after).
- Account deletion backend (`0033`, W7 route) with tests, and the in-app flow proven on a throwaway
  account: its cards stop resolving, its payment rows remain anonymised.

### M5 — Push (Mon 23 – Fri 27 Nov) ⚠ shares the week with M4; may slide into the next

- Explainer, then the OS prompt; refusal handled.
- A lead submitted on the public page arrives on the Camon within 10 s — app in the background and
  app swiped away — and tapping it opens the lead.
- First-tap push on a dispatched test card; term-ending push from the cron, run against a test identity.
- Per-type switches respected; signing out stops delivery to that phone. HiOS settings documented,
  and the help screen added if needed.

### M6 — Web ↔ app (Mon 30 Nov – Fri 4 Dec) ⚠ shares the week with M7

- The links files are served correctly; Apple's CDN check passes; Android reports the links verified.
- With the app installed: dashboard links in lead and first-tap emails open the right screen; renewal
  (billing) and dispatch (orders) links stay in the browser; **card taps and profile links always
  open the browser on both platforms**, tested with a real card.
- Banners on `/` and `/dashboard` only, dismissal remembered, with an automated test for the rest;
  `/app` page live; `/account/delete` works; privacy policy updated.

### M7 — Hardening and betas (Mon 30 Nov – Fri 4 Dec)

- Maestro flows pass (Android locally; iOS on EAS or by manual script).
- Budgets met: cold start ≤ 3.0 s on the low-end profile and ≤ 1.5 s on the Camon; Android download
  ≤ 25 MB.
- Accessibility walkthrough on both platforms; contrast tests green.
- Update channels live and one OTA update applied to a preview build; `0034` and the minimum-version
  switch verified.
- TestFlight (internal) and Play internal testing live with at least three testers; no untriaged
  crash in Sentry after 48 hours of beta use.

### M8 — Store submission (Mon 7 – Fri 11 Dec)

- Icons (iOS 1024 px, Android adaptive), splash, screenshots (iPhone 6.9" and 6.5", Android phone),
  listings with no purchase language, Apple privacy labels, Play Data safety (with the deletion URL),
  content ratings, review notes with the demo account and NFC video.
- Both apps submitted by **Fri 11 Dec**.

### Review week (Mon 14 – Fri 18 Dec)

Answer reviewers within a day; JavaScript-only fixes go out as OTA updates; native fixes are
resubmitted. ⚠ This is the only buffer, and review queues slow before the holidays.

**Slips flagged now:** (1) store accounts, if the D-U-N-S request waits past early October;
(2) M4 and M5 sharing a week; (3) M6 and M7 sharing a week; (4) each web deploy in M2–M6 waits on
your go-ahead — a late approval moves the milestone.

**Cut order if we fall behind** (the brief's, refined): the term-ending push first, then the other
notifications, then analytics beyond headline numbers and the daily chart, then onboarding.
**Never cut:** NFC set-up, account deletion, crash reporting.

---

## 16. Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Apple/Google organisation accounts late (D-U-N-S, verification) | High | High | Start this week; build Android first; iPhone work last within M4 | Kelvin |
| NFC library misbehaves on the New Architecture | Medium | High | M0 hardware spike; local-module fallback with the same interface | Claude |
| App Review rejection (payment wording, missing info, NFC not testable) | Medium | Medium | §3 wording rules, review notes, demo account, video; budget one round | Both |
| Sign-in emails throttled at launch (Resend 100/day, Supabase 30/h) | High without changes | High — people locked out | Resend Pro, raised limit, password path, clear error | Kelvin |
| Mail scanners use up the link token, and with it the code | Medium (corporate mail) | Medium | W8 interstitial; password fallback | Claude, with approval |
| Link-id bug amplified by autosave | Certain if unfixed | High — analytics integrity | W4 and `0030` before autosave ships | Claude |
| HiOS blocks push on Tecno and Infinix | Medium | Medium | Camon test; high priority; in-app guide | Both |
| Cold start over 3 s on low-end phones | Medium | Medium | Budgets, measurement in M0 and M7, cache-first paint | Claude |
| SDK 58 lands mid-project with navigation changes | High that it ships | Low–Medium | 31 Oct gate; no upgrades from M1 to launch | Claude |
| Web launch competes with October | High | Medium | M0 asks ~3–4 hours of you; revenue work stays first | Kelvin |
| Old app versions against a changing schema | Grows over time | Medium | Versioned API, additive migrations, boundary checks, minimum-version switch, OTA | Claude |
| A deletion mistake is irreversible | Low | High | Recent sign-in, explicit consequences, one transaction, tests, audit row | Claude |
| Name collision ("TapTap") | Medium | Medium | "Hornbill TapTap" in stores; unique link scheme | Kelvin |
| Many phones have no NFC | High | Low | Serial fallback | Claude |
| Data protection gaps (new processors; ODPC still open) | — | High (legal) | W13 policy update; ODPC registration (already a launch blocker) | Kelvin |
| The same profile edited on the web and in the app at once | Low | Low | The app route checks `updated_at`; the web keeps last-save-wins | Claude |

---

## 17. Decisions to record once approved

In `docs/decision-log.md`'s format, mirrored in `PROJECT.md`:

- **D-034** — The mobile app is an Expo package in `/mobile`, not a workspace, importing allow-listed
  pure `lib/` modules; the web build is fenced off from it.
- **D-035** — The app reads through RLS and database functions and writes through them where the
  database enforces the rule; rules that live in TypeScript are reached through versioned
  `/api/app/v1` routes. Schema changes stay compatible with the oldest supported app build.
- **D-036** — No purchases or purchase prompts in the app or its listings (Apple 3.1.3(f), Google Play
  Payments); card status uses neutral wording; payment instructions travel by email.
- **D-037** — App sign-in is code-first (email code, password); emailed links are a convenience.
- **D-038** — An NFC tap in the app links a card the account already owns (D-027 unchanged); in-app
  reads never log analytics and never close orders.
- **D-039** — Account deletion anonymises the account and keeps financial records; the business's
  cards stop working; in a multi-member account only the member is removed.
- **D-040** — Push goes through Expo's service, with preferences per device and no customer personal
  data in the notification.
- **D-041** — The app follows the phone's light or dark theme; the web stays light-only for its phase
  (CLAUDE.md §8).
- **D-042** — Saving a draft preserves action ids; a click is recorded even when its action has since
  gone (the link-id fix).

---

## 18. Questions for you

**Before M0 starts — answered 28 Sep 2026**

1. ~~Approve the plan?~~ **Yes.**
2. ~~Bundle ID `ke.co.hornbilltech.taptap`?~~ **Confirmed.**
3. D-U-N-S number? **Not yet** — to be requested. Still open: who enrols with Apple and Google, and
   which `@hornbilltech.co.ke` address owns the accounts.
4. ~~NFC on the Camon; which iPhone?~~ **Camon has NFC; iPhone 14.**
5. ~~W1 and W2?~~ **Yes** — done in M0.

**By M1 / M2**

6. ~~Emailed links: move them to a new `/auth/confirm` page with a "Continue" button (W8)?~~
   **Yes — approved 9 Oct 2026, built in M1 (D-043).**
7. ~~The link-id fix changes the web's Save as well (W4 + `0030`). Approve it for both?~~
   **Yes — approved with M2, 11 Oct 2026 (D-046).** The web editor also gains the conflict prompt.
8. Store name "Hornbill TapTap", with "TapTap" as the home-screen label?
9. Dark mode in the app while the web stays light-only — confirm?

**By M4 / M5**

10. Account deletion: immediate after a fresh sign-in; profiles and leads deleted; cards stop working;
    payment and order records kept, anonymised, for five years (please confirm the period with your
    accountant). Agreed?
11. Notifications: no customer names or numbers in the text (my recommendation), or would you rather
    show "Jane from ACME left her details"?
12. Term-ending push: include it with neutral wording, or leave those reminders to email only (zero
    App Review risk)?

**By M6 – M8**

13. Availability: Kenya only, or more countries? I suggest leaving out the EU.
14. Costs: Resend Pro (US$20/month) before the first beta and EAS Starter (US$19/month) from late
    November, on top of Apple's US$99/year and Google's US$25 — agreed?
15. Beta testers: who, with their emails — Magangi's team?
16. May I prepare the reviewer demo account (§13) for you to create in production?

---

## Sources checked on 27 September 2026

- Expo SDK releases: <https://expo.dev/changelog>, <https://expo.dev/changelog/sdk-57>,
  <https://expo.dev/changelog/sdk-58-beta>; platform support: <https://docs.expo.dev/versions/latest/>
- EAS pricing: <https://expo.dev/pricing>; Maestro on EAS:
  <https://docs.expo.dev/eas/workflows/examples/e2e-tests/>; Maestro on Windows:
  <https://docs.maestro.dev/getting-started/installing-maestro/windows>
- NFC library: <https://github.com/revtel/react-native-nfc-manager> (npm: `latest` 3.17.2,
  `beta` 4.0.0-beta.9); ITMS-90778: <https://developer.apple.com/forums/thread/123483>
- Apple App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>;
  enrolment: <https://developer.apple.com/programs/enroll/>
- Google Play Payments: <https://support.google.com/googleplay/android-developer/answer/9858738>;
  target API: <https://support.google.com/googleplay/android-developer/answer/11926878>;
  account deletion: <https://support.google.com/googleplay/android-developer/answer/13327111>;
  organisation accounts and testing:
  <https://ontest.app/blog/personal-vs-organization-google-play-account-12-testers>
- Supabase email codes and templates:
  <https://supabase.com/docs/guides/auth/auth-email-passwordless>,
  <https://supabase.com/docs/guides/auth/auth-email-templates>; session storage in React Native:
  <https://supabase.com/blog/react-native-authentication>,
  <https://docs.expo.dev/versions/latest/sdk/securestore/>
- Resend limits: <https://resend.com/pricing>
