# Hornbill TapTap mobile app — progress

Live status against `docs/mobile/PLAN.md`. Newest first within each milestone.

| Milestone | Dates (brief) | Status |
|---|---|---|
| Step 1 — plan | by 27 Sep | ✅ Approved 28 Sep 2026 |
| **M0 — setup** | by Sat 31 Oct | 🟡 **In progress** — code done; phone checks now run on the M1 dev build |
| **M1 — sign-in and shell** | 2–6 Nov | 🟡 **Started early, 9 Oct (approved)** — deployed, Supabase changed, dev build `b0c3324a` runs on the Camon; next: your inbox test and the phone session |
| **M2 — profile, share, QR** | 9–13 Nov | 🟡 **Started 11 Oct (approved)** — committed and pushed; `0030` applied and the web deployed to production 11 Oct; next: dev build, phone session |
| **M3 — leads and analytics** | 16–20 Nov | 🟡 **Started 11 Oct (approved)** — code done and verified (320 app tests, 952 web tests, `0031` run against Postgres); push registration deferred until Firebase exists; next: commit, apply `0031`, phone session |
| M4 — cards and NFC | 23–27 Nov | Not started |
| M5 — push | 23–27 Nov ⚠ | Not started |
| M6 — web ↔ app | 30 Nov–4 Dec ⚠ | Not started |
| M7 — hardening and betas | 30 Nov–4 Dec | Not started |
| M8 — store submission | 7–11 Dec | Not started |

---

## M3 — leads and analytics

**Started 11 Oct** with your approval ("then proceed", after M2 was committed and pushed), about
five weeks early, while M1's and M2's phone sessions are still to do.

**Changed from the plan, flagged rather than done quietly:** push device registration (`0032`
and the app side), which the plan pulled forward from M5 into M3, **is not built yet**. A phone
can only get a push token once a Firebase project exists and its Android config is in the app
— your Google account — and code that cannot run on a phone would ship untested. It is next as
soon as Firebase exists (see "What you need to do", step 4).

### Done-means checklist (PLAN.md §15)

- [ ] Leads: 500 sample leads scroll without blank rows on the low-end profile — built as a
      virtualised list (only rows on screen are drawn, pages of 30 fetched as you scroll);
      **needs a phone and sample data.**
- [x] Filters with counts, pull-to-refresh, paging, detail with call, WhatsApp and email — built
      and tested (navigation tests open a lead from the list; WhatsApp is offered first).
- [x] Status and note change instantly and survive offline → online — built: shown at once,
      queued while offline, kept on the phone if the app is closed, sent in order on reconnect.
      Tested, including a change surviving a simulated restart. Phone test pending.
- [x] Delete with confirmation; badge for new leads — built and tested; delete needs the network.
- [x] Analytics: 7 / 30 / 90 days and per-profile scope — built. Numbers come from the web's own
      `get_analytics` with the web's own arithmetic (lib/analytics.ts), so they match by
      construction; **a side-by-side check with the web is pending.**
- [x] Charts respect reduce-motion — the charts have no animation at all.
- [ ] `0031` and `0032` applied after a dry run — **`0031` written and run against Postgres;
      yours to approve.** `0032` deferred (above).
- [ ] Push device registration works — deferred (above).

### Built on 11 Oct

**Database — `0031_leads_cursor.sql`:** `get_leads` takes a cursor (the created_at and id of the
last lead shown) and returns everything strictly older, ordered by created_at then id — so leads
that share a timestamp are never repeated or skipped. The old signature is dropped and the new one
created in the same migration. **The page cap is 5,000, not the 200 the plan said:** the web's CSV
export asks for 5,000 in one call, and a 200 cap would have cut exports short without a word.
Every existing web call keeps working unchanged.

**Web:** no code change — only the migration and its tests.

**Mobile (no new native modules, so the `f0500f92` dev build runs it):**

- Leads tab: newest first, a page at a time; status chips with counts (All, New, Contacted, Won,
  Lost); search within what is loaded; pull to refresh (back to the first page only); skeletons,
  empty and error states; a badge on the tab with the number of New leads.
- Lead screen: what they sent, WhatsApp / Call / Email (WhatsApp first), status and a private note
  that saves as you type, earlier enquiries from the same number or email, delete.
- Analytics tab: 7 / 30 / 90 days, all profiles or one; the six counts with their change against
  the period before (no "0%" when there was nothing before); clicks and confirmed actions with the
  web's honest wording; page opens by day; most-clicked actions; and — for accounts with a live
  card — how visitors arrived, which card, busiest hours and where. Without a card, one plain line
  says what those need; no word about buying (PLAN.md §3).
- Home: the last 7 days' page opens, clicks and leads, each against the 7 days before.

### Verification, 11 Oct

- **`0031` against real Postgres** (PGlite, with 0012's version first): 13 checks pass — the web's
  existing call returns the same leads and fields after the upgrade; exactly one `get_leads`
  remains; paging two at a time visits every lead once across a three-way timestamp tie; the
  returned timestamp round-trips exactly; cursor plus status filter; profile filter with repeat
  counts kept within the account; another account's profile returns nothing; the 5,000 cap and a
  floor of 1; `anon` denied.
- **Web:** 952 tests (+5 on the migration text), `tsc` and `eslint` clean.
- **Mobile:** 320 tests (+31: paging and cursors, cache updates, the offline queue across a
  restart, ordered sends, analytics shapes, dates, and navigation flows for the inbox, a lead and
  analytics), `tsc` and `eslint` clean.
- **Bundle:** 5.79 MB (M2 5.72 MB; budget 7 MB).

### Findings

33. The plan's `0031` cap of 200 per page would have truncated the web's CSV export (5,000 per
    call) silently. Capped at 5,000 instead.
34. The web's busiest-hours label calls midnight "12 PM" when the busiest window ends at 24:00
    (`hourLabel(24)`). The app wraps to "12 AM". Cosmetic; noted for the web's next analytics pass.
35. Lead status and note use last-write-wins, not M2's conflict prompt: they are the owner's own
    annotations (0012), and two devices disagreeing about one is not worth stopping for.
36. **No events recorded since 2 Oct.** Traffic has always been sparse — 22 of the 36 days from
    28 Aug to 2 Oct had any events, never more than 61 in a day, and the longest quiet spell was 4
    days — but 9 days with nothing is the longest yet. A real tap on a live profile is the cheapest
    check that tracking still works; your own account has no live profile.

### What you need to do

**1. Let me commit** (and push, if you want it on GitHub).

**2. Apply `0031`** — needed before the Leads tab works on the phone (the app sends the new
cursor arguments, which the old function does not have). Safe for the website.

```powershell
cd C:\Projects\taptap
supabase db push --dry-run
supabase db push
```

The dry run should list only `0031_leads_cursor.sql`. Or say "apply 0031" and I'll do it as I did
`0030`.

**3. On the Camon** (with M1 and M2's sessions, same build `f0500f92`; restart
`npx expo start --dev-client`):

1. **Leads tab:** your leads, newest first; the chips show counts; the tab shows a badge with the
   number of New ones. Pull down to refresh.
2. Open one: WhatsApp opens a chat with their number; Call and Email work.
3. Set it to **Contacted**: the badge drops by one at once. Type a note, go back, reopen: the note
   is there.
4. **Airplane mode on**, set another lead to Won, close the app completely, airplane mode off,
   reopen: it is Won on the website too.
5. Delete a test lead (the confirmation explains it is permanent).
6. **Analytics tab:** compare 30 days, all profiles, with the website's Analytics page — the six
   counts must match. Switch to 7 and 90 days and to one profile.
7. **Home:** "Last 7 days" shows three numbers; tapping them opens Analytics.

**4. For push (next):** create a Firebase project for TapTap (free), add an Android app with the
package `ke.co.hornbilltech.taptap` (and `ke.co.hornbilltech.taptap.dev` for the dev build), and
tell me when it exists — I'll walk you through the FCM key for EAS. Then I build `0032`, the
registration and the permission explainer, which needs one more dev build.

---

## M2 — profile, share and QR

**Started 11 Oct** with your approval ("proceed m2"), about four weeks early, while M1's phone
session is still to do. That approval is also taken as yes to question 7 (the link-id fix changes
the web's Save too). Decision D-046.

### Done-means checklist (PLAN.md §15)

- [ ] Home shows the live profile and its status within a second from cache — built: Home reads
      the cached profiles first and draws the published snapshot natively; **phone test pending.**
- [x] Edit photo, name, tagline, bio, contact card, actions and look; "Saving… → Saved ✓" is shown —
      built and tested (navigation tests drive an edit through autosave); phone test pending.
- [x] Edits made offline save on reconnect — built: every edit is written to the phone first and
      sent when online (18 tests cover offline, retry, restart and sign-out); phone test pending.
- [x] An edit made meanwhile on the web is detected, not overwritten — built in both editors
      (`409` → "Keep my version" / "Load the latest"); tested; phone test pending.
- [ ] Publish → the public page shows the change immediately (checked on a second phone) — built
      (`publish_page`, after saving anything unsent); **needs `0030`, the web deploy and a phone.**
- [ ] Photo uploads stay under 300 KB and appear on the public page — the size rule is tested;
      **the upload itself only runs on a phone** (new dev build needed).
- [x] Share opens WhatsApp with the link filled in; "More" opens the system share sheet; "Copy link"
      shows a toast — built; phone test pending.
- [ ] The full-screen QR scans from another phone at 1 m in normal light — built (drawn on the
      phone with the web's encoder and settings, tested against it); **needs a second phone.**
- [ ] **Link-id fix live** (W4, `0030`): **`0030` applied and the web deployed to production,
      11 Oct.** Saving keeps action ids — tested (web and Postgres); clicks on the live page still
      recorded after a draft save — reproduced and fixed against Postgres. **Seen live, 11 Oct:** an app
      save and a web save (after the fix, finding 32) on "kev" kept its action (created 8 Oct), and
      eight app autosaves on "jijhdgjn" kept its. **Still to see live:** a click on a live profile
      after a draft save — your account has no live profile (no card), so it needs a customer's or
      a test card.

### Built on 11 Oct

**Database — `0030_page_draft_and_click_attribution.sql` (you apply it):**

- `save_page_draft()`: the whole draft in one transaction, as the signed-in person (`SECURITY
  INVOKER`, so RLS and the column grants still decide). Actions are upserted by id; only removed
  ones are deleted; an id that belongs to another page is refused and everything rolls back. The
  version check sits in the same statement as the write.
- `updated_at` now moves only when the draft changes (title, type, destination, config, theme, or
  the actions through a save). Publishing, unpublishing and switching off leave it alone, so they
  never look like someone else's edit.
- `log_event`: a click on an action that no longer exists, or belongs to another page, is recorded
  without the action instead of failing. Same signature; every caller unchanged.

**Web (deploy only with your OK, after `0030`):**

- `lib/draft.ts` (new, shared with the app): the draft's shape and rules — which values make a dead
  button, the lead-form rule — so the app accepts exactly what the server will.
- `lib/page-draft.ts` (new, W4): the one save behind the editor's Save and the app's autosave.
- `lib/api/request-user.ts` (new, W3): the Bearer-token check for app routes (`auth.getUser`, then
  queries run as that user).
- `app/api/app/v1/pages/[id]/draft/route.ts` (new, W5): `PUT`, the app's autosave. **New public API
  route** (approved as part of M2).
- `lib/page-diff.ts` and `lib/phone.ts` (new, W6, shared with the app): "does the draft differ from
  what customers see?" and Kenyan phone numbers.
- Web editor: new actions get their id when added; every save sends ids and the version it was
  based on; a change saved elsewhere shows "This profile was changed somewhere else" with Reload /
  Keep my version; "Unpublished changes" now stays until the changes are published.

**Mobile:**

- Home: the profile as customers see it (or the draft, if it isn't live), its status in one word
  — Live, Unpublished changes, Draft, Not active, Switched off — and Share, QR code, Edit profile.
  A profile switcher for accounts with more than one; pull to refresh.
- Editor: photo or logo, name, tagline, about, actions (add, edit, show/hide, move up/down,
  delete), contact card, look (light/dark and ten button colours), lead form where the account has
  a live card, Preview, Publish / Unpublish. Saves itself; works offline; never queues Publish or a
  photo upload.
- Add/edit action: the value is checked as the server will, and phone numbers to Kenyan length,
  before the action joins the draft.
- Share sheet (WhatsApp, More, Copy link) and a full-screen QR code drawn on the phone, encoding the
  same `…/<slug>?src=qr` as the web's QR codes, so scans count as scans.
- New native modules: `expo-image-picker` (camera and microphone permissions blocked; Android's
  photo picker needs none), `expo-image-manipulator`, `expo-clipboard`; plus `qrcode`'s encoder
  (the web's library and version). **They need a new dev build.**

### Verification, 11 Oct

- **Migration run against real Postgres** (PGlite, with the production tables, RLS and grants, as
  the `authenticated` role): 16 checks pass — the bug reproduced before `0030` (a click on a removed
  action fails its foreign key); after it, ids kept, order applied, removed actions deleted,
  conflicts refused with the current version, the version round-trips exactly, publish/unpublish/
  switch-off leave it alone, another account's page and ids refused with a full rollback,
  malformed input refused, clicks on removed or foreign actions kept, `anon` denied.
- **Web:** 945 tests (833 before; +112, including the migration text, the route, the save, the
  Bearer check and 4 editor UI tests), `tsc` clean, `eslint` clean, `next build` succeeds with the
  new route.
- **Mobile:** 289 tests (213 before), `tsc` clean, `eslint` clean. Navigation tests now drive Home,
  an autosaved edit, adding an action (a short number refused first), a conflict and a publish.
- **Bundle:** 5.72 MB (M1 5.24 MB; budget 7 MB).
- **Permissions** (resolved config): Android asks for INTERNET, NFC and VIBRATE; CAMERA and
  RECORD_AUDIO are actively removed. iOS asks only for photo-library access.
- `npm audit` lists 70 advisories in the app's tree, all in Expo CLI and Jest tooling, none in the
  new packages or the shipped bundle. Left for M7.

### Findings

22. **The link-id bug is real.** Reproduced against Postgres: before `0030`, a click on an action
    the draft has replaced fails `log_event`'s foreign key, and `/api/track` swallows the error.
    Any live profile edited after its last publish would drop clicks on the replaced buttons.
    **Measured on 11 Oct, before applying `0030`: 0 of the 26 buttons on the 10 live profiles**
    — every live profile had been published after its last save, so nobody was losing clicks
    that day. The past cannot be measured: a lost click left no row.
23. **Publishing changed `updated_at`** (the 0001 trigger bumps it on any update), which would have
    made every publish look like a conflicting edit to the other device. Now it tracks the draft only.
24. **A subtle RLS case, found by the Postgres run:** an action id that belongs to *another
    account* is invisible under RLS, so the upsert silently skipped it and the action vanished from
    the save without an error. Nothing leaked, but it now fails loudly and rolls back.
25. The 8-argument `log_event` overload from 0002 can no longer be reached: every caller passes
    `p_source`, and a call without it matches both overloads and is refused as ambiguous. Left as
    is rather than rewritten.
26. Reanimated's Babel plugin reads `.value` inside a style as one of its shared values and
    injects a warning; the colour list uses `hex`.
27. After a save, the editor's badge flashed the old status for a frame (a prop from the parent
    lagged the unsent-edits store by one render). Fixed and covered by a test.
28. The server trims text on save. Copying that back into the editor would delete a space someone
    paused after ("Mama " → "Mama", then "MamaNjeri"). The phone keeps what was typed.
29. A save sent to a website without the new route (deployed before it) gets the site's own 404
    page. Reading that as "profile deleted" would have discarded the edits; only the route's own
    `not_found` answer counts now, anything else is retried.
30. Home's "this week's numbers" (PLAN.md §6) moves to M3, where the analytics screen is built on
    the same function. Not in M2's done-means.
31. **Worth a separate decision:** Vercel runs the web's functions in the US by default, and the
    database is in Ireland. Each app save makes about six round trips (the token check, the page,
    three billing reads, the save), so roughly half a second. Fine for autosave; pinning functions
    to Dublin (`dub1`) would speed up every server-rendered page too. A web-wide change, so not
    made here.
32. **A regression I shipped, live for about an hour on 11 Oct.** The database stores an empty
    action label or value as null; the web editor sent the nulls back; the new draft check wanted
    text. So every web Save failed ("Something in this draft could not be saved") on profiles with
    a "Save contact" action or an unlabelled one — **12 of 14 page profiles, 8 live**. Nothing was
    lost: saves were refused and the old draft stayed. Found because your test save on "kev" never
    reached the database (the production logs showed the request; the row had not changed). Fixed
    in `f7ecd0f` (null reads as empty, plus a test with the exact nulls Supabase returns) and
    deployed to production as `taptap-13fdyvrba` within the hour. The app was never affected — it
    turns nulls into text when it reads — and its saves were already working live: "jijhdgjn" kept
    its one action (created 27 Sep) across eight autosaves. My earlier editor test used only filled
    values, which is how this got past 945 tests. Every other new limit was checked against all
    existing rows the same evening: none would refuse a save.

### What you need to do

**1. Commit** — ✅ done 11 Oct: `e4a9045` (web and `0030`), `8eeec88` (app), `979dc47` (docs);
pushed.

**2. Apply `0030`** — ✅ **done 11 Oct, at your request** ("apply 0030 and deploy the web for
me"). The CLI connected through its login role; `migration list` showed the database at `0029`
with only `0030` pending; the dry run listed only `0030`; it applied cleanly. Checked afterwards
on the database: `save_page_draft` exists and is not SECURITY DEFINER, `authenticated` may run it
and `anon` may not; `smart_pages` now has `smart_pages_touch_draft` and
`smart_pages_enforce_publish` (the old always-bump trigger is gone); the 10-argument `log_event`
keeps clicks on removed actions; the migration history reads `0030`. For the record, the commands:

```powershell
cd C:\Projects\taptap
supabase db push --dry-run
supabase db push
```

The dry run should list only `0030_page_draft_and_click_attribution.sql`. *Optional, before
applying:* how many buttons on live profiles are dropping clicks right now (SQL editor, read-only):

```sql
select count(*) filter (where l.id is null) as dropping_clicks, count(*) as live_buttons
from smart_pages sp
cross join lateral jsonb_array_elements(sp.published_content->'links') x
left join links l on l.id = (x->>'id')::uuid
where sp.status = 'published';
```

*After applying:* `select proname from pg_proc where proname in ('save_page_draft', 'smart_pages_touch_draft');`
should return both.

**3. Deploy the web** — ✅ **done 11 Oct**, from `mobile-app` at `979dc47`. The first preview
attempt answered "Not authorized" (as on 10 Oct); the retry deployed
`taptap-1bngpwki7-…vercel.app`. On the preview: `/` and `/login` 200, `/dashboard` 307, an
unknown slug 404 (no real customer slug requested), the new route 401 `{"code":"unauthorized"}`
with no token and with a fake one, 405 for GET. Production `taptap-rkvi4wkr4-…vercel.app`, on
`taptap.hornbilltech.co.ke`: the same answers, `/auth/confirm` 307, and the route sends
`Cache-Control: no-store`. **Your check on the web** found finding 32: the first deploy's Save refused profiles with blank
labels or values. Fixed and redeployed the same evening: `f7ecd0f`, preview
`taptap-58tguxna3`, production `taptap-13fdyvrba` (the domain points at it). Publishing from your
own account correctly shows the activation prompt: `kelvinoyugi101` has no card (D-021). Production now runs code
from `mobile-app`, which is ahead of `main`: a PR to merge it is overdue (since M1).

**4. Build the new dev app** — ✅ **built 11 Oct** (your approval): `f0500f92`, from the M2 commits, finished cleanly. Install page: <https://expo.dev/accounts/hornbill-taptap/projects/hornbill-taptap/builds/f0500f92-ed27-4cb4-bacb-0f2b88724202>. The photo picker, image resizing and clipboard are native modules.
It uses the third of October's 15 free Android builds:

```powershell
cd C:\Projects\taptap\mobile
npx eas-cli@latest build --profile development --platform android
```

**5. One session on the Camon** (after 2–4; about 40 minutes with M1's checks, which can run in the
same sitting):

1. **Home:** your profile as customers see it, its status, and your link. With two profiles, the
   name at the top switches between them.
2. **Edit profile → change the business name.** "Saving…", then "Saved". Home says "Unpublished
   changes"; your public page in a browser still shows the old name.
3. **Publish changes.** The public page (refresh it) shows the new name. Home says "Live".
4. **Add an action:** Add action → WhatsApp → type `0722 000` → Add action: it says the number is
   too short. Fix it, add it, move it up and down, switch it off and on, then delete it.
5. **Photo:** Add a photo → pick one → crop. It appears in the editor; publish; it appears on the
   public page. (Tell me how long the upload took.)
6. **Offline:** airplane mode on, change the tagline: "Saved on this phone…". Close the app
   completely, reopen it, airplane mode off: it saves by itself. Publish is disabled while offline.
7. **Conflict:** with the editor open on the phone, change the name on the website and save there.
   Then change something on the phone: "Changed somewhere else" — try both buttons.
8. **Share:** Share on WhatsApp (pick yourself; the link is filled in), More options, Copy link.
9. **QR code:** scan it from another phone at about a metre. It should open your profile.
10. **Look:** switch Dark, pick a button colour, open Preview: it matches what you chose.
11. With the largest font size and TalkBack on, the editor's switches, arrows and colour swatches
    each read with a name.

---

## M1 — sign-in and shell

**Started 9 Oct, about three weeks early**, with your approval, in parallel with M0's phone checks.
You also approved W8 (emailed links land on `/auth/confirm`) the same day. Decisions D-043 – D-045.

### Done-means checklist (PLAN.md §15)

- [x] Sign in with a password, with an emailed code, and reset a password by code; sign out —
      built; proven by the navigation tests (below); **phone test pending.** The code path also
      needs the Supabase changes (step 3).
- [ ] The session survives killing the app and restarting the phone — built (encrypted session,
      D-044); phone test pending.
- [x] An expired session returns to sign-in with a message ("You were signed out…") — built and
      tested; phone test pending.
- [x] Welcome once (three pages, skippable); five tabs (placeholders until M2–M4); Account with sign
      out — built and tested.
- [ ] Offline: after one sign-in, launching in airplane mode shows the app from cache with the
      offline banner; sign-in explains when it is offline — built and tested; phone test pending.
- [x] Every string from `en.json`, enforced by lint — 0 problems.
- [ ] TalkBack reads every control; the largest font size does not clip sign-in — labels, roles and
      states are in place; needs the phone. VoiceOver waits for the Apple account.
- [ ] Template change made and the web magic link still works; W8 live — built; **needs your web
      deploy and the dashboard changes** (steps 2–3).

### Built on 9 Oct

**Web — W8 and a security fix (deploy only with your OK):**

- `app/auth/confirm/` (new page, server action, button): opening the page only shows "Continue";
  the token is used when the person presses it. Unknown links go to sign-in; OAuth codes and
  provider errors are handed to `/auth/callback`, which stays for Google and for emails already in
  inboxes. Not indexed by search engines.
- `lib/email-link.ts` (new): the OTP type check (moved from the callback) and how `next` is read
  out of a link — from `next`, or from inside `redirect_to`.
- `app/login/login-form.tsx`: magic-link, sign-up and reset emails now point at `/auth/confirm`;
  Google still returns to `/auth/callback`. New passwords need 8 characters; signing in sets no
  minimum, so accounts made under the old minimum of 6 still get in.
- `lib/safe-next.ts`: **security fix** — finding 14.

**Mobile:**

- Sign-in (`app/sign-in.tsx`): email and password as the one primary action; "Email me a code";
  "Forgot password?"; offline and "you were signed out" notices; plain-English errors.
- Code (`app/sign-in-code.tsx`): six boxes over one real input, so typing, pasting, iOS's "From Mail"
  suggestion and screen readers all work; signs in on the sixth digit; "Send a new code" waits out
  Supabase's one-email-a-minute limit.
- Reset (`app/forgot-password.tsx`): email → code → new password twice. If the new password is
  refused, it can be fixed without a new code.
- Welcome (`app/welcome.tsx`): three pages, swipe or Next, Skip; once per install.
- Shell: `app/(app)/(tabs)/` — Home (business name from cache), Leads, Analytics, Cards
  (placeholders), Account (business, email, sign out with a confirmation sheet, developer checks in
  dev/preview builds). The M0 check screens moved to `app/dev/`, reachable from sign-in too.
- Routing (`app/_layout.tsx`): `Stack.Protected` guards. Welcome, sign-in and the app each exist only
  while their guard holds, so signing in, out, or finishing a reset moves screens by itself. The
  splash holds until the session, the welcome flag and the cache are known.
- Session (`src/auth/`): AES key in SecureStore, encrypted session in AsyncStorage, a new key per
  write; the signed-in state as a tested pure reducer (D-044); local sign-out that works offline;
  Sentry gets the user id only.
- Data (`src/api/`): TanStack Query persisted to the phone for 7 days (dropped on upgrade and
  sign-out), online/offline from `expo-network`, refetch on return to the app; the `me` query
  (business name); response shapes checked by `shape.ts` (D-045).
- UI: TextField (label, error, show/hide password), CodeField, Notice, OfflineBanner, Toast,
  ConfirmSheet, ListRow, EmptyState, Skeleton, icons (`src/ui/icons.ts`); reduced-motion hook;
  Screen now handles the keyboard.
- Packages: Supabase, AsyncStorage, SecureStore, expo-crypto, expo-network, react-native-svg,
  lucide-react-native (per-icon), aes-js, TanStack Query (+ persister); NFC library → `4.0.0`;
  Reanimated `4.5.1`, Gesture Handler `2.32.0` and Worklets `0.10.1` pinned (finding 16); SDK 57
  patch releases. Android: `ACCESS_WIFI_STATE` blocked (expo-network adds it; unused).
- `mobile/.env.local` (git-ignored): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (the
  publishable key, checked to start `sb_publishable_`), `EXPO_PUBLIC_SITE_URL` (production — emailed
  links must point at the live site). Copied from the web's `.env.local` without printing them.

### Verification (9 Oct)

| Check | Result |
|---|---|
| Mobile lint / typecheck | 0 problems / clean |
| Mobile tests | 12 suites, **209 passed** (148 at M0) |
| Navigation tests (`src/navigation.test.tsx`, the real `app/` routes) | 8 passed: welcome once → sign-in; password → app; wrong password → message, stays; code → code screen (`shouldCreateUser: false`, link to `/auth/confirm`); stored session → app with no network; server sign-out → sign-in with message; reset keeps the person on the screen until the password saves, and a refused password is retried without a second code |
| Icon lint rule | a probe importing `lucide-react-native` is refused |
| `expo-doctor` / `expo install --check` | 21/21 / up to date |
| `expo config --type introspect` | dev IDs; plugins include `expo-secure-store`; Android permissions INTERNET, VIBRATE, NFC (+ ACCESS_NETWORK_STATE from expo-network at build); storage, overlay and Wi-Fi state blocked; iOS NFC entitlement `["TAG"]` |
| Android bundle (`expo export`) | **5.24 MB** Hermes bytecode (budget 7 MB; 4.4 MB at M0) |
| Web typecheck / lint | clean / 0 problems |
| Web tests | 56 files, **833 passed** (820 at M0) |
| Web `next build` | success; `/auth/confirm` added as a dynamic route |
| `/auth/confirm` on a local production server | valid link → 200, "Continue", `noindex`, `next` read from an encoded `redirect_to`; reset link → "Reset your password"; bad type → sign-in with "not valid"; bare → sign-in; `?code=` → `/auth/callback`; `next=/\evil.example` → `/dashboard`. Opening the page never used a token (none was valid; the page makes no Supabase call until Continue) |

### Findings

14. **Open redirect after sign-in (web, live in production).** `safeNext` accepted any path starting
    with one `/`. Browsers treat `\` as `/` and delete tabs and line breaks, so
    `next=/%5Cevil.example` and `next=/%09/evil.example` both resolve to `https://evil.example/`.
    Proven with Node's URL parser. A crafted `/login?next=…` link would send someone to another site
    the moment they signed in. **Fixed** (backslashes and control characters refused anywhere in
    `next`) with tests that resolve every hostile value against the real origin. It sits on this
    branch until you deploy; it is worth shipping on its own, soon (step 2).
15. **Metro bundles whole packages.** Icons from `lucide-react-native`'s root pulled in all ~1,600,
    and `zod/mini` pulled in every zod language (889 KB of source). The bundle hit 7.9 MB, over
    budget. Icons now come one file each (lint-enforced) and zod is replaced by `shape.ts`:
    5.24 MB (D-045).
16. **Expo Router compiles Reanimated, Gesture Handler and Worklets into the app.** Its drawer's
    required peers pull them in; npm had chosen their newest releases — Gesture Handler 3.3.0, a
    major version past SDK 57's 2.32 — and autolinking builds them in whether or not the app uses
    them. Worklets 0.13 was also outside `expo-modules-core`'s supported range, which made npm
    nest `expo-modules-core` and broke the test runner. All three are now pinned to SDK 57's
    versions. M0's 29 Sep build very likely carried the newer ones; it compiled, but on an untested
    combination. They add native size to the APK, which M7 measures.
17. **Live Supabase auth settings differ from the plan** (read-only dry-run pull, 9 Oct): the email
    code is **8** digits (the app uses 6) and the minimum password is **6**. Both change in step 3.
    Also seen, not used by the web or the app: **SMS sign-in (Twilio) is switched on**, and an
    **Apple sign-in provider has a secret set**. Worth confirming both are intended; if not, switch
    them off.
18. **supabase-js reports no session offline once the token has expired** (`getSession()` refreshes
    first, and a failed refresh returns null), though the refresh token is kept. The app trusts the
    stored session instead (D-044). Separately, `signOut()` defaults to signing out everywhere,
    website included; the app signs out this phone only. Offline, supabase-js refuses to sign out
    a session it cannot load, so the app removes it from storage itself.
19. **Local testing of `/auth/confirm`:** Supabase's redirect allow-list has
    `http://localhost:3000/auth/callback` only, so emailed links requested from `localhost` fall
    back to the live site. Optional fix in step 3.
20. **Not in M1, moved:** Kenyan phone parsing (W6) goes to M2, which has the first phone fields.
    EAS environment variables for preview and production builds (the three `EXPO_PUBLIC_` values
    above) are needed before the first preview build (M0's cold-start timing), not before.
21. **The dev build crashed on launch (11 Oct) — `UnsatisfiedLinkError … NativeStatePropsGetter
    .clearAllContentOriginsImpl`.** An Expo bug, not ours. Since SDK 57's 6 Oct patches
    (`@expo/ui` 57.0.22, `expo-modules-core` 57.0.21, still the newest), `@expo/ui` — pulled in by
    Expo Router — calls a native method of `expo-modules-core` whenever a React instance is torn
    down. That library loads only once the app's JavaScript starts. So any teardown before the
    JavaScript ran (here: a reload, per the trace) crashes, and hides the real first failure,
    usually a bundle that never downloaded. Checked: the method is compiled in
    (`RN_FABRIC_ENABLED=1`), and leaving `@expo/ui` out is unsafe (its views are looked up at
    import, 58 places). PC side verified: Metro is running and serves the 11 MB dev bundle over
    `192.168.0.107:8081` with no bundling error; Windows calls the Wi-Fi Public, but Node.js is
    allowed inbound on Public. **Fix:** `plugins/with-expo-core-preload.js` loads the library in
    `MainApplication.onCreate`, right after React Native, so the call is always safe — verified by
    prebuild, with 4 tests. It matters for store builds too (expo-updates reloads after a startup
    error). Needs a new native build. Remove when Expo fixes `@expo/ui`. **Rebuilt 11 Oct:**
    commit `646b9ca` (pushed with the branch), build `b0c3324a` finished 13:58 UTC — the plugin
    ran in prebuild (it fails the build if its anchor is missing), `:app:compileDebugKotlin`
    passed, `BUILD SUCCESSFUL in 14m 7s`, debug APK 261 MB. 2 of October's 15 free Android builds
    used. Install page:
    <https://expo.dev/accounts/hornbill-taptap/projects/hornbill-taptap/builds/b0c3324a-44af-4a5b-9115-6413726c57c0>.
    **On the Camon, 11 Oct:** installed, loaded the bundle from Metro and reached sign-in. The
    exact path that crashed (a reload before the JavaScript runs) is checked by reloading from the
    red screen with Metro stopped; until then the fix is proven by build only.

### What you need to do

*10 Oct — you asked me to run steps 1–4:*
- *✅ Step 1: committed on `mobile-app` (not pushed): `869f685` redirect fix, `0952883` W8,
  `0c82f09` M1 app, `eb1f64e` docs. Secret scan clean; a JWT-shaped fake in a test was renamed so
  it no longer trips the scan.*
- *✅ Step 2: preview `taptap-a6zzshiy1` passed every check (`/`, `/login`, `/privacy`, `/pricing`
  200; `/dashboard` → `/login`; unknown card and slug 404; `/auth/confirm` renders Continue with
  `next=/admin` from an encoded `redirect_to`; bad links → sign-in; `?code=` → `/auth/callback`).
  **Production `taptap-f8ilhjzul` is live.** On `taptap.hornbilltech.co.ke` the confirm page
  serves, and the login form now receives `/dashboard` for `next=/\evil.example`,
  `next=/<tab>/evil.example` and `next=//evil.example`: **finding 14 is closed in production.**
  (The first deploy attempt answered "Not authorized"; the immediate retry went through.)*
- *✅ Step 3, through the dashboard in your Chrome after you signed in (`supabase config push`, which
  is field-level since CLI 2.117, was refused by Claude Code's permission check):*
  - *Email OTP length **8 → 6**, minimum password **6 → 8**, expiry left at 3600 — confirmed
    afterwards with a read-only `config diff` (no differences left).*
  - *Templates **Magic link**, **Reset password** and **Confirm sign up** now link to
    `/auth/confirm`; Magic link and Reset password carry the `{{ .Token }}` code block. Subjects and
    the existing plain style kept. Each re-read from Supabase after saving. Reset keeps the
    hard-coded `next=/reset-password` it already had; the other two pass `redirect_to`.*
  - ***Root cause of the lost `next` confirmed:** all three old templates built the link as
    `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=…` and never used
    `{{ .RedirectTo }}`, so `next` could not survive (launch checklist §1b updated).*
  - *Old bodies, for rollback: Magic link — "Your sign-in link" heading, "Follow the link below to
    sign in. This link expires shortly and can only be used once.", link "Sign in" with
    `type=magiclink`. Confirm sign up — "Confirm your email address" heading, "Follow the link below
    to confirm this email address and finish signing up.", link "Activate my account" with
    `type=signup`. Reset — "Reset your password" heading, "Someone asked to reset the password for
    your Hornbill TapTap account.", link "Choose a new password" with
    `type=recovery&next=/reset-password`, "If this wasn't you, ignore this email — your password
    stays as it is." All pointed at `/auth/callback`, which still works.*
  - ***Still to do — yours, needs your inbox:** the web tests at the end of step 3 below (sign-in
    link via `/admin`, and Forgot password).*
- *✅ Step 4: dev build `dbc3ce23` **finished** 07:08 UTC, about 16 minutes (5.8 MB upload, existing
  keystore; `app.json` untouched). Log: `npm ci` ran in `build/mobile` only (1,109 packages);
  Secure Store, expo-network, SVG, NFC 4.0.0 and the pinned Reanimated / Gesture Handler /
  Worklets all compiled; `BUILD SUCCESSFUL in 15m`; debug APK 261 MB (256 MB at M0 — debug builds
  carry every processor type and are not the size users download). Install page:
  <https://expo.dev/accounts/hornbill-taptap/projects/hornbill-taptap/builds/dbc3ce23-210a-4465-a93f-6ac960ac65ba>.
  It used 1 of October's 15 free Android builds.*

**1. Review and commit** (you commit; I ran no git command that changed anything). Before
committing, run your secret check from the repo root: `git status` must show no `.env` file, and
`mobile/.env.local` must not appear (it is git-ignored). Suggested commits, in order:

```powershell
cd C:\Projects\taptap
git add lib/safe-next.ts app/auth/callback/callback.test.ts
git commit -m "Refuse backslashes and control characters in sign-in redirects"
git add lib/email-link.ts app/auth/confirm app/auth/callback/route.ts app/login/login-form.tsx app/login/login-form.test.tsx
git commit -m "Make emailed sign-in links wait for a press of Continue (W8)"
git add mobile
git commit -m "Add sign-in, session and the app shell to the mobile app (M1)"
git add docs PROJECT.md
git commit -m "Record M1 and decisions D-043 to D-045"
```

**2. Deploy the web — preview first, then production.** The redirect fix (finding 14) is live
risk, so this is worth doing soon. Deploying from `mobile-app` also ships M0's build fences (W1,
W2), which the 28 Sep preview already proved harmless.

```powershell
cd C:\Projects\taptap
$env:NO_UPDATE_NOTIFIER=1; vercel
```

On the preview URL: `/auth/confirm?token_hash=x&type=email` shows "Sign in to TapTap" and a
Continue button (pressing it with this fake token goes to sign-in with an error — expected);
`/login` works; sign in with your password. Then `$env:NO_UPDATE_NOTIFIER=1; vercel --prod`.

**3. Supabase dashboard — only after step 2 is live in production** (the new links point at a page
that must already exist):

- *Authentication → Sign In / Providers → Email:* **Email OTP Length 8 → 6**; **minimum password
  length → 8** (people with shorter passwords can still sign in; only new passwords need 8). Leave
  the expiry at 3600.
- *Authentication → Emails → Templates.* Keep each subject and your styling; replace the link and add
  the code block:

  **Magic Link**

  ```html
  <h2>Sign in to TapTap</h2>
  <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}">Sign in to TapTap</a></p>
  <p>Using the TapTap app? Enter this code instead:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:8px 0">{{ .Token }}</p>
  <p>The link and the code work once and expire in 60 minutes. If you didn't ask to sign in, you can ignore this email.</p>
  ```

  **Reset Password**

  ```html
  <h2>Reset your password</h2>
  <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}">Choose a new password</a></p>
  <p>Using the TapTap app? Enter this code instead:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:8px 0">{{ .Token }}</p>
  <p>The link and the code work once and expire in 60 minutes. If you didn't ask for this, ignore this email: your password stays the same.</p>
  ```

  **Confirm signup** (the app never signs anyone up, so no code here)

  ```html
  <h2>Confirm your email</h2>
  <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}">Confirm your email and sign in</a></p>
  <p>If you didn't create a TapTap account, you can ignore this email.</p>
  ```

  Leave *Change Email Address* and *Invite* as they are; their links still work.
- *Optional — Authentication → URL Configuration → Redirect URLs:* add `http://localhost:3000/**` so
  links requested while testing locally come back to your PC (finding 19).
- **Then test on the web:** sign out; open `/admin` (you land on `/login?next=/admin`); request a
  sign-in link; open it → "Sign in to TapTap" → Continue → you should land on **`/admin`**. If you
  do, the `next` bug from the launch checklist (§1b) is fixed. Then test "Forgot password?" →
  link → Continue → the new-password page.

**4. Build the new dev app** — needed because M1 adds native modules; the 29 Sep build cannot run
this code. It uses 1 of October's 15 free Android builds.

```powershell
cd C:\Projects\taptap\mobile
npx eas-cli@latest build --profile development --platform android
```

Accept the defaults (the keystore exists now); answer **n** to the emulator question. **Done
means** the build page says *Finished*. Tell me either way; I'll read the log.

**5. One session on the Camon** (about 30 minutes; covers M0 and M1). Install the APK over Wi-Fi
(it replaces nothing — "TapTap Dev" was never installed), then on the PC
`cd C:\Projects\taptap\mobile; npx expo start --dev-client` and scan the QR code from the app.

1. **Welcome:** three pages; swipe and Next both work; Skip goes to sign-in. Close and reopen the
   app — no welcome again.
2. **Sign in with your password.** Wrong password first: the message names the problem. Then the
   right one: Home shows your business name.
3. **Kill the app** (swipe it away) and reopen: still signed in, no sign-in screen. Restart the
   phone and reopen: still signed in.
4. **Airplane mode on**, reopen the app: Home shows with "You're offline…" and the business name.
   Airplane mode off.
5. **Sign out** (Account → Sign out → Sign out): sign-in screen, "Signed out." toast. Your website
   session is still signed in.
6. **Email me a code** (after step 3's dashboard change): the email has a 6-digit code and a link;
   type the code — signed in. Try a wrong code once: the message says so.
7. **Forgot password?** → email → code + new password twice → signed in with "Password changed."
8. **Developer checks** (Account, or the link at the bottom of sign-in): the M0 checks — theme
   follows light/dark; largest font size (also on sign-in: nothing clipped or overlapping);
   **NFC check → Scan a card** with a TapTap card, a bank card, NFC switched off, and the browser
   must not open; **Send a test error to Sentry** → it appears within a minute.
9. **TalkBack on**, on sign-in: every field and button is read with a name; the code boxes read as
   one "6-digit code" field.
10. Note anything that looks or feels wrong, especially the keyboard covering a button (the
    Android keyboard handling is the part I could not check here).

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
- [ ] Dev build on the Camon, following the phone's theme — **built 29 Sep** (`a8b753f9`), never
      installed. **Superseded 9 Oct:** M1 adds native modules (secure storage, crypto, network,
      SVG) and moves NFC to 4.0.0, so that build cannot run today's code. The M1 dev build replaces
      it, and M0's phone checks run on it (M1 section, "One session on the Camon").
- [x] Token parity and contrast tests pass (114). 28 Sep.
- [ ] First cold-start measurement — needs a preview (release) build; a dev build is not representative.
- [ ] **NFC spike on the Camon** — code ready (`app/dev/nfc.tsx`); needs the dev build.
- [ ] NFC spike on the iPhone 14 — needs the Apple Developer account (needs the D-U-N-S number).
- [ ] Sentry shows a test crash — DSN received 28 Sep (US region) and set for local development in
      the git-ignored `mobile/.env.local`; needs the dev build. Preview and production builds get it
      from the EAS environment variable, set 28 Sep.
- [x] SDK 57 vs 58 decision — **SDK 57, decided 9 Oct.** SDK 58 is still pre-release (npm
      `next` = 58.0.6; `latest` = 57.0.27) because React Native 0.88 is still a release candidate
      (`0.88.0-rc.4`). Starting M1 early (approved 9 Oct) puts the navigation code on 57, and the
      plan allows no SDK upgrades from M1 to launch. SDK 57 patch releases are applied (57.0.27).

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
13. **The NFC library went stable on 9 Oct** (`react-native-nfc-manager` 4.0.0, now npm `latest`;
    `4.0.0-beta.10` on 3 Oct and `beta.11` that morning came first). The dev build `a8b753f9`
    carries `beta.9`. What changed since then, against our code: `TagEvent.ndefMessage` is now
    optional in the types — `readCardRecords` already accepts `undefined`; an Android fix makes
    `getNdefMessage()` read the chip live — we read through `getTag()`, which is unchanged; the
    config plugin is safe to run twice and honours permission opt-outs; no runtime API breaks.
    **Done (9 Oct):** pinned to exactly `4.0.0`. Because M1 started the same day and needs a new
    native build anyway, the spike runs on that build, which tests the version we ship. No build
    credit is spent on the upgrade alone. With 4.0.0, `expo-doctor` passes 21 of 21, so finding 9's
    "untested on New Architecture" warning is gone; the hardware spike still decides.

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
   - *28–29 Sep, two builds:* failed in Gradle on a missing splash image (finding 12) — fixed.
   - ✅ *29 Sep, third build `a8b753f9`:* **finished** in about 18 minutes, queue included.
     Install page:
     <https://expo.dev/accounts/hornbill-taptap/projects/hornbill-taptap/builds/a8b753f9-65d3-4c43-a410-24bb152b95bb>.
     The NFC library (v4 beta), Sentry and `expo-updates` all compiled on the New Architecture; the
     only compiler warnings are in third-party code. The APK is **256 MB** — normal for a debug
     development build (unoptimised, native code for all four processor types), so download it on
     Wi-Fi. It says nothing about the ≤ 25 MB budget, which applies to the release build (M7).
   - *9 Oct: superseded before it was installed — M1 needs a new native build (M1, step 4).*

### Build notes

- The `preview` profile skips Sentry source-map upload (`SENTRY_DISABLE_AUTO_UPLOAD`) until a
  Sentry auth token exists as an EAS secret. `production` has no such switch, on purpose: a store
  build must never ship without readable crash reports.

### What you'll test on the Camon, once the dev build is installed

*Superseded 9 Oct: these checks now run on the M1 dev build, from "Developer checks" — see M1,
"One session on the Camon", item 8. Kept for the record.*

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
