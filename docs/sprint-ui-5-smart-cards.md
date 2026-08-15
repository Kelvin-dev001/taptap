# Sprint UI-5 — Smart Business Cards

**Date:** 2026-08-15 · **Status:** Complete · **Follows:** `docs/sprint-ui-4-builder.md`

Smart Business Cards ship as a **template facet of Tap Profiles**, not a second product
(CLAUDE.md §17). No new rendering path, no new builder, and **no migration** — the template
lives in `config` jsonb.

---

## The nav question, settled

UI-2 deferred a decision: §13 lists "Smart Business Cards" as a likely nav item, while §17
says not to build a disconnected second product. UI-2 left it out and said UI-5 would decide.

**Decision: no separate nav destination.** A card uses the same builder, the same publish
path, the same analytics and the same NFC binding — the only differences are defaults and
which fields lead. A nav item would split one short list into two half-empty screens and
imply two products where there is one engine. Cards are reached instead by a **type filter**
on Tap Profiles (All / Pages / Cards / Redirects), held in the URL so a filtered view is
shareable.

Worth overruling if cards later grow a genuinely distinct workflow — bulk issuing for staff,
say. Today they do not have one.

---

## What shipped

### 1. `lib/templates.ts`

Two templates, defined by what actually differs:

| | Business page | Personal card |
|---|---|---|
| Identity heading | "Your business" | "Your details" |
| Name field | Business name | Your name |
| Line under the name | Tagline | Job title · Company, from the vCard |
| Contact card | behind **Advanced** | promoted to the top |
| Seed order | review → WhatsApp → call → directions → website | vCard → call → WhatsApp → email → website |

Everything else — renderer, publish, analytics, NFC — is shared. `templateOf()` treats
anything created before this sprint as a business page, so nothing changes for existing pages.

### 2. A first profile that is actually useful

Creating a profile now seeds real actions from the business details captured in Settings
(migration `0007`): phone, WhatsApp, website, Google review link, location. This is §20's
"quickly produce a professional first Tap Profile" made concrete — an owner who filled in
Settings gets a working page immediately instead of an empty shell.

**The rule that makes seeding safe:** never seed an action without a value behind it. A
seeded button with nothing to open is a dead button on a customer's phone. `seedBlocks()`
emits only actions it has real values for; the vCard action is the sole exception, because it
is built from the contact fields at download time. Tested explicitly.

Seeding is best-effort and degrades quietly: if `accounts.profile` is missing because
migration `0007` has not been run, creation proceeds with no seed rather than failing.

### 3. Card-aware rendering

`roleLine()` builds a card's subtitle from the vCard `title` and `org`, so the line under the
name **cannot disagree** with the contact a visitor downloads. A business page keeps its own
tagline, and an explicit tagline always wins. For the same reason the builder hides the
tagline field on cards — two sources of truth for one statement is how they drift.

### 4. Creation as a choice of intent

The create form now asks *what are you making* — Business page, Personal card, or Single
redirect — before asking for any detail, with the field labels adapting to the answer
("Your name" vs "Title").

---

## Tests

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **169 passed** (152 + 17 new), 23 files |
| `npm run build` | compiled successfully |
| Route smoke | `?type=card` and `?type=bogus` both handled; **0 runtime errors** |

New coverage: template resolution and its fallbacks, role-line derivation and precedence,
seed ordering per template, and the no-valueless-block rule.

## Not done, and why

- **No card-specific layout beyond the role line.** A card and a business page share a
  renderer; the difference is content order and emphasis, which the templates already control.
  Inventing a second visual treatment would recreate the duplication §17 warns about.
- **No bulk card issuing** (a card per staff member from one screen). That is the workflow
  that would justify its own nav item, and it needs the team model, which does not exist.
- `config.template` is not indexed, so the filter runs in memory. Correct at this size; if a
  single account ever holds thousands of profiles it becomes a generated column plus an index.

## Technical debt

Unchanged from UI-4. Still outstanding and worth repeating: **the builder has not been
exercised by hand** — drag, upload, publish, and now template switching and seeding, are
covered by tests and typecheck but nobody has clicked through them.

> ⚠ **Migrations `0005`, `0007`, `0009` are still pending.** `0007` matters more now: without
> it, new profiles are seeded with nothing.

## Next sprint proposal — UI-6: NFC + QR

Device inventory with names rather than token tails, claim/assign/repoint/replace as a clear
lifecycle, QR generation with preview, size and format options, and a print workflow. Backend:
**B3** (`events.source`) and **B4** (`events.tag_id`) — the pair that makes per-device
analytics possible at all, and without which the reference mockup's "reception stand is
underperforming" insight cannot exist. Sprint UI-0 also flagged that physical NFC verification
is required for acceptance here; that needs real cards and a real phone.
