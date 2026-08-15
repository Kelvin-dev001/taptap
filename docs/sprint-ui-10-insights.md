# Sprint UI-10 — Insights

**Date:** 2026-08-15 · **Status:** Complete · **Follows:** `docs/sprint-ui-9-billing.md`

UI-0 sequenced this as the "AI" sprint and hard-blocked it on trustworthy data. UI-6 and UI-7
supplied that data. What ships is **Insights**: deterministic rules over real counts, with
every finding showing the numbers behind it (D-016).

---

## Why rules rather than a model

Everything genuinely useful here is computable and provable. An action outperforming those
above it is arithmetic on `sort_order` and click counts. A card silent while its siblings are
busy is a comparison of `tag_id` totals. A model would add phrasing, not knowledge — and
§30.8 explicitly forbids presenting hard-coded analysis as AI.

There is a second reason, which matters more in practice: **an owner can argue with a stated
number, but not with an oracle.** Every card shows its evidence, so a business that knows its
reception card is deliberately hidden can dismiss that finding and move on.

A model would earn its place for genuine anomaly detection over a long history, natural-
language questions, or generating page copy. None of those is available from counts, and each
should be its own decision against this baseline. Full reasoning in `docs/decision-log.md`.

---

## The two rules that govern the rules

1. **Never speak from noise.** Every rule carries a minimum volume, so the product does not
   advise a business to rearrange its page on the strength of three clicks. The thresholds sit
   together in `lib/insights.ts` with the reasoning attached.
2. **Every claim shows its evidence.** If a finding cannot state its numbers and link to the
   screen that proves them, it is not shipped.

## What it looks for

| Finding | Fires when | Guard against noise |
|---|---|---|
| **Move an action up** | a lower action beats one above it | ≥12 clicks **and** ≥1.5× the one above |
| **Dead button** | a published action has no destination | none — one broken promise is enough |
| **No actions** | a live page has nothing to press | none |
| **Traffic, no clicks** | people open and leave | ≥30 opens |
| **Idle card** | one card silent while others are busy | ≥2 active cards, ≥20 account taps, card ≥14 days old |
| **Leads waiting** | enquiries untouched over a week | — |

The **idle card** rule is the reference mockup's *"reception stand is underperforming"*, made
honest. It can only fire when the account's **other** cards are being tapped, so a quiet month
for the whole business is never blamed on one card — and a newly claimed card is given two
weeks before being judged. Both are tested.

**Dead buttons and empty pages are read from the published snapshot**, not the editable draft:
a broken button only matters once it is live, and an owner who fixed the draft without
publishing has not fixed it yet.

## Architecture

Migration `0013` supplies **facts only** — counts, orders, timestamps. Every threshold and
every sentence lives in `lib/insights.ts` as a pure function, so the rules are unit-testable
without a database and a reviewer can read the whole of what the product will claim in one
file.

`insight_dismissals` keeps rejected findings hidden. Without it the panel nags: a suggestion an
owner has considered and declined would return on every page load. Keys are stable across
recomputation, which a test asserts.

Rendered in the slot UI-3 reserved on the dashboard. **No new nav item** — consistent with §13
and with the reasoning that kept Smart Business Cards off the sidebar in UI-5.

## Empty states say which kind of empty

"No insights" reads as broken. The panel distinguishes *publish something first*, *not enough
activity yet to say anything useful*, and *nothing needs your attention* — the last being a
genuinely good outcome rather than a failure to find fault.

---

## Tests

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **260 passed** (237 + 23 new), 28 files |
| `npm run build` | compiled successfully |
| Route smoke | 0 runtime errors |

The rule engine is the product here, so the tests are the specification: each rule is checked
for both firing *and* staying silent — below volume, on near-ties, when an action is already
on top, when the whole account is quiet, when a card is too new to judge, and when a page is
still a draft. Plus dismissal, key stability, severity ordering, and that every finding has
evidence.

## Technical debt

- Insights recompute on every dashboard load. Cheap at this size, but `get_insight_inputs`
  scans the account's events for the window; it should be cached or materialised if an account
  ever carries heavy traffic.
- Thresholds are global constants. A market stall and a car dealership plausibly need
  different volumes before advice is meaningful; per-account tuning is a real future need.
- No insight history — a finding that appears and resolves leaves no trace, so there is no way
  to show "you fixed this".
- Carried forward: no error/loading boundaries, `force-dynamic` everywhere, no `public/` or
  favicon, `middleware`→`proxy` rename pending, **prices still DRAFT**, the builder still
  unexercised by hand, and **physical NFC verification outstanding from UI-6**.

> ⚠ **Migrations `0012` and `0013` are pending.** The Insights panel simply does not render
> until `0013` is applied — the dashboard is unaffected either way.

## Next sprint proposal — UI-11: PWA / mobile polish

The last two sprints before production polish. UI-11 covers what CLAUDE.md §23 asks for: a web
manifest and icons (there is still **no `public/` directory at all** — no favicon, no
apple-touch-icon, no OG image), installability, an offline shell, and a pass over the mobile
experience with the shell, builder and inbox on a real handset.

Worth flagging now: the reference mockup's bottom tab bar was deliberately deferred from UI-2
to this sprint, on the grounds that seven destinations do not fit five tabs and mobile usage
should decide which five matter. There is still no usage data to decide with, so I would keep
the drawer and revisit once the product has real mobile traffic — but that is a judgement call
worth your view.
