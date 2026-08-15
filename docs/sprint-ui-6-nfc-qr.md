# Sprint UI-6 — NFC + QR

**Date:** 2026-08-15 · **Status:** Complete in software · **physical verification outstanding**
**Follows:** `docs/sprint-ui-5-smart-cards.md`

---

## The gap this sprint closes

Before today an NFC tap and someone typing the URL were recorded **identically**.
`/t/<token>` redirected to `/<slug>?src=nfc` and the slug route logged a plain `tap`, so
"NFC taps vs QR scans" was guesswork — and nothing in the database connected an event to a
*card*.

That second gap mattered more than it looked. The reference mockup's insight — *"reception
stand is underperforming: 3 taps/day at reception vs 21 at the till"* — was not merely
unbuilt, it was **unanswerable**. A business with a card at the till, one at reception and
one on each table had no way to learn which was working. Migration `0010` makes the question
answerable for the first time.

---

## What shipped

### 1. Migration `0010` — attribution (B3, B4, B11)

- **`events.source`** — `nfc` / `qr` / `direct` / `web`, constrained in the database and
  re-validated in `log_event`.
- **`events.tag_id`** → `nfc_tags`, with a partial index for per-card queries.
- **`log_event`** gained both as trailing optional parameters, so existing callers keep
  working during a deploy in either order. The 8-argument signature stays granted.
- **`resolve_tag`** now returns `tag_id` and `page_id`, so the tap can be attributed without
  a second query on the latency-critical tap path.
- **`get_devices_overview`** — per-card taps and last-tap, ordered by activity.
- **`replace_tag`** — swaps a lost card for a new one in one transaction.
- **B11** — `events.region` is finally written, from `x-vercel-ip-country-region`.

**`source` is deliberately not back-filled.** Events recorded before this migration have no
captured origin, and inventing one is precisely what §30.7 forbids. Old events read as
unknown, and the devices page says so in as many words.

### 2. Taps attributed where the card is actually known

The tap is now logged **in `/t/<token>`**, because that is the only place that knows which
physical card was involved — the slug route sees a URL, not a card. `?src=nfc` then tells the
slug route the interaction is already recorded, so it does not count the same tap twice.

| Path | Event | Source |
|---|---|---|
| `/t/<token>` | `tap` + `tag_id` | `nfc` |
| `/<slug>?src=nfc` | *(suppressed — already logged)* | — |
| `/<slug>?src=qr` | `scan` | `qr` |
| `/<slug>` | `tap` | `direct` |

A side effect worth noting: NFC taps on **page-mode** profiles were previously never counted
as taps at all — only redirect-mode profiles logged one. They are counted now.

### 3. Device inventory

Cards are **named**. `nfc_tags.label` has existed since migration `0005` and was never
surfaced, so cards could only be told apart by the last six characters of a random token.
Each card now shows its name, status, bound profile, taps in the selected window, and when it
was last tapped — with inline rename, repoint, disable and replace.

**Replace** exists because a lost card is a real event with a real hazard: doing the swap
client-side in two steps would leave a window where both the old and new card resolve.
`replace_tag` disables the old card and moves its binding in a single transaction.

### 4. QR that is fit to print

- **SVG** alongside PNG. A printed raster QR at sticker or A6 size looks ragged and scans
  less reliably; vector stays sharp at any physical size.
- **Sizes** 256–2048, clamped server-side rather than trusted.
- **Error correction raised to Q (~25%)**. These end up on table tents and stickers that pick
  up scratches and grease; the redundancy costs only a slightly denser code.
- **`?token=`** encodes the permanent `/t/<token>` card URL instead of the slug, so a printed
  code survives the business renaming its link — the whole point of D-009, finally reflected
  in what gets printed.
- **`/print/qr`** — six cards to an A4 page with cut guides, outside the dashboard shell
  because sidebars have no business on a page whose only job is to come out of a printer.
- Preview and download hit the same endpoint, so what is on screen is what gets saved.

No new dependency: the `qrcode` package already emits SVG.

---

## Tests

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **178 passed** (169 + 9 new), 24 files |
| `npm run build` | compiled successfully |
| Live endpoint check | PNG, SVG, token-encoded and print sheet all verified against a running server |

## Defects fixed

1. **A missing `size` silently produced the smallest QR.** `Number(null)` is `0`, and
   `Number.isFinite(0)` is true — so the guard clamped an *absent* size to the 256 minimum
   instead of using the documented 512 default. Every preview and download came out at the
   smallest size. Found by comparing the live endpoint against its own documentation; the
   unit test had covered `size=notanumber` but never the absent case. Both are covered now.
2. `Button` gained `asChild` (Radix Slot) after three sprints of working around its absence.
   Links that look like buttons now stay anchors — the same reasoning as finding A5.
3. `/print` added to `RESERVED_SLUGS`; a new top-level route would otherwise have been
   claimable as a customer slug.

## ⚠ Physical verification is still outstanding

Sprint UI-0 made physical NFC testing an acceptance requirement for this sprint, and it
**has not happened** — it needs real cards and a real phone, which I cannot do. What needs
checking, in order:

1. Encode a card with `https://taptap.hornbilltech.co.ke/t/<token>` and tap it on **Android**
   (background NFC reading) and **iPhone** (needs iOS 14+; older models require Control Centre).
2. Confirm the tap lands on the right profile and that a `tap` event appears with
   `source = 'nfc'` and the correct `tag_id`.
3. Repoint the card to another profile and tap again — the chip must not need re-encoding.
4. Disable the card and confirm the tap stops resolving.
5. Print a QR from `/print/qr` at 100% scale and scan it from ~30cm.

Until step 2 passes, per-card analytics is unproven against real hardware even though the
software path is tested.

## Technical debt

- Per-card analytics counts only attributed events, so numbers start from zero at migration
  time. Correct, but worth telling early customers so a card does not look dead.
- `replace_tag` requires the new card's token to be typed. Fine for a handful of cards;
  a scan-to-replace flow would be better once volumes justify it.
- Carried forward: no error/loading boundaries, `force-dynamic` everywhere, no `public/` or
  favicon, subscription expiry unenforced (B13), `middleware`→`proxy` rename pending, and the
  builder still has not been exercised by hand.

> ⚠ **Migrations `0005`, `0007`, `0009`, `0010` are pending.** `0010` is required for this
> sprint's screens; the devices page shows a notice until it is applied.

## Next sprint proposal — UI-7: Analytics

Now that `source` and `tag_id` exist, analytics can finally answer questions rather than
count. Range selector on every view, a genuine click-vs-conversion split, per-source and
per-device breakdowns, geography from the `country`/`region` now being captured, and CSV
export. This is also the sprint that unblocks UI-10, which UI-0 hard-blocked on trustworthy
data.
