# ROLE
You are a senior mobile engineer and product designer who has shipped consumer apps
with the polish of WhatsApp, Instagram, TikTok, M-PESA and Bolt for Kenyan users.
I (Kelvin) am building my first mobile app: explain every new mobile concept (dev
build, EAS, bundle ID, signing, TestFlight, Play testing tracks, iOS Developer Mode)
in 2–3 plain sentences the first time it comes up.

# CONTEXT
Hornbill TapTap is a Kenya-first smart digital identity platform (NFC cards, QR,
smart links), web app at taptap.hornbilltech.co.ke. Read PROJECT.md and
docs/decision-log.md first, then the codebase. Stack: Next.js 16 + React 19 on
Vercel, Supabase (auth, Postgres with RLS, Storage), M-Pesa via Next.js route
handlers, NFC tags resolve at /t/<token>, profiles also have slugs.
Features: Smart Profile editor + themes, vCard, QR, analytics, lead capture + CSV,
plans, NFC card claim flow, admin minting.
OUT OF SCOPE: Fuel Rewards and anything petrol-station related. Do not build for it.

# GOAL
A professional native app for Android and iOS, for TapTap card owners only, from
one TypeScript codebase. Live on Google Play and the App Store by mid-December 2026,
with a clear path from the web app to download it. Built for 1,000+ users.

# FIXED DECISIONS
- Audience: card owners only.
- Publisher: Hornbill, using company (organization) accounts on Apple and Google.
  Proposed bundle/package ID: ke.co.hornbilltech.taptap (confirm with me).
- English only in v1, but every string goes through i18n so Kiswahili can follow.
- No purchases in v1. The app shows plan status and expiry only; card orders and
  plan payments stay on the web. No buttons or links in the app that send users to
  pay elsewhere. Check the current App Store Guideline 3.1 and Google Play Payments
  policy and tell me if this approach needs adjusting.
- No social login in v1 (adding Google sign-in would oblige Sign in with Apple).

# STACK (confirm or challenge in your plan before building)
- Expo (latest stable SDK), React Native, TypeScript strict, Expo Router.
- Same Supabase project; supabase-js with sessions in expo-secure-store.
- Anything needing secrets or the service role stays in Next.js route handlers.
  Adapt any the app needs to accept the Supabase access token as a Bearer header.
  Never ship secrets in the app.
- EAS Build / Submit / Update (I'm on Windows; iOS builds run in the cloud).
- NFC: react-native-nfc-manager via config plugin (dev build, not Expo Go).
- Push: expo-notifications. Crashes: Sentry. Lists: FlashList. Images: expo-image.
- Put the app in the repo (e.g. /mobile) with shared types and pure logic. Propose
  the least disruptive layout and prove it does not break the Vercel deploy.

# SIGN-IN
The web uses Supabase magic link and email + password. In the app:
- Primary: email + password, and "email me a code" using Supabase email OTP with
  a 6-digit code. Update the email template to include both the link and
  {{ .Token }} without breaking the web magic link.
- Magic links may also open the app via Universal Links / App Links, but never
  rely on them: email apps often open links in their own browser.
- Password reset inside the app.
- Confirm Supabase uses a custom SMTP provider; the built-in sender is
  rate-limited and not for production.
- List every Supabase dashboard change (redirect URLs, templates) for me to make.
- Create a reviewer demo account (email + password, with a sample profile, leads
  and analytics) for Apple and Google review.

# KENYAN UX REQUIREMENTS (non-negotiable)
- Design for low/mid-range Android first, iPhone second. Cold start under 3 s on
  a 2–3 GB RAM phone; keep the download small.
- Test devices: my Tecno Camon 30 Pro (HiOS: check that battery optimisation
  does not block notifications), an iPhone, and an emulator configured as a
  low-end phone, because most users' phones are slower than mine.
- Patchy networks: cache data, optimistic updates, clear offline and retry
  states, never a blank screen; compress images before upload.
- Familiar patterns: bottom tab bar (max 5 tabs), tap targets of at least 48dp,
  one primary action per screen, skeleton loaders, pull-to-refresh, native share
  sheet with WhatsApp prominent, haptics on key actions, toasts instead of alerts.
- Phone fields accept 07..., 01... and +254... formats.
- Short plain English copy. Light and dark mode, font scaling, screen-reader
  labels, good contrast. Use the web app's brand colors, fonts and logo as tokens.

# V1 SCOPE (propose the final list; keep it lean)
Onboarding (max 3 screens) → sign in → tabs: Home (profile preview + quick
share/QR), Leads, Analytics, Cards (claim a card by tapping it with NFC on Android
and iPhone, manage cards), Account (plan status, privacy, sign out, in-app account
deletion). Notifications: new lead, first card tap, plan expiring.

# WEB → APP DOWNLOAD
- Download banner on the landing page and logged-in dashboard ONLY. Never on public
  profile pages (/t/<token>, /<slug>): people tapping a card must never be pushed
  to install anything.
- iOS Smart App Banner meta tag; custom Android banner to Play Store; remember
  dismissals. A /app page with store badges and a QR code.
- Universal Links / Android App Links (apple-app-site-association, assetlinks.json)
  so dashboard and sign-in links open the app when installed. Public profile links
  always stay on the web.

# STORE & COMPLIANCE
- Privacy policy link, Apple privacy labels, Play Data safety form, account
  deletion (in-app and a web URL), permissions requested only when needed with a
  short explanation screen (camera, NFC, notifications). Respect Kenya's Data
  Protection Act, 2019.

# QUALITY BAR
- ESLint + Prettier; unit tests for logic; Maestro end-to-end tests for sign in,
  edit profile, share and claim card.
- Sentry live before the first beta; EAS Update channels (preview, production).
- Audit every Supabase table the app touches for RLS, indexes on hot queries,
  and unbounded or N+1 queries.

# HOW WE WORK
1. Before writing any code, write docs/mobile/PLAN.md: architecture, folder
   layout, screen list + navigation map, data/API contract per screen, changes
   needed in the Next.js app, risks, and milestones with acceptance criteria.
   End with your questions for me. Then STOP and wait for my approval.
2. Build one milestone at a time. After each, tell me exactly what to run, what
   to test on my phones, and what "done" looks like. Keep docs/mobile/PROGRESS.md
   updated.
3. Ask me before: any git command, EAS builds or submissions, anything touching
   my Apple/Google/Expo accounts, Supabase schema changes (write migrations; I
   apply them), and any change to the web app's public routes.
4. Record key decisions in docs/decision-log.md in its existing format.

# TIMELINE (plan backwards from this; flag slips the moment you see them)
The web launch has priority until 31 Oct; October mobile work is plan + setup only.
- By Oct 31, M0: PLAN.md approved, Expo app in repo, dev build on my Camon, tokens.
- Nov 2–6, M1: all sign-in paths, app shell, navigation, i18n.
- Nov 9–13, M2: profile view + editor, share, QR.
- Nov 16–20, M3: leads + analytics.
- Nov 23–27, M4: cards + NFC claim on Android and iPhone; M5: push notifications.
- Nov 30–Dec 4, M6: web download banner + deep links; M7: hardening (Sentry,
  Maestro, low-end performance, accessibility). Start TestFlight and Play
  internal testing.
- Dec 7–11, M8: icons, splash, screenshots, listings, privacy forms; submit to
  both stores.
- Dec 14–18: fix review feedback; live.
If we fall behind, cut in this order: notifications, analytics polish, onboarding
screens. Never cut NFC claim, account deletion or crash reporting.

Start with step 1 now.