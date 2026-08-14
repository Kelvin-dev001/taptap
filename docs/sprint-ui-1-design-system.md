# Sprint UI-1 — Design System Foundation

**Date:** 2026-08-15 · **Status:** Complete · **Follows:** `docs/sprint-ui-0-audit.md`

Goal: give the product a real design system — tokens, typography and reusable primitives —
without redesigning a single page. Acceptance was "existing functionality remains intact and
the new system is reusable."

---

## What shipped

### 1. Design tokens (`app/globals.css`, `tailwind.config.ts`)

`theme.extend` went from `{}` to the full system. Values are declared once as CSS custom
properties and merely surfaced as Tailwind classes, so there is one source of truth per value.

- **Colour** — 11-step brand ramp plus semantic roles (`surface`, `surface-inverse`,
  `foreground`, `muted`, `border`, `success`/`warning`/`danger`/`info`). Implements D-012:
  `primary` (`#F97316`) is only for fills carrying no text; `primary-strong` (`#C2560A`,
  4.53:1 on white) backs every labelled button and orange text. `success` moved to `#15803D`
  because the `#16A34A` in use failed at 3.30:1.
- **Typography** — a named role scale (`display`, `page-title`, `section-title`, `card-title`,
  `body`, `body-sm`, `label`, `caption`, `metric`, `metric-lg`) with paired line-height,
  tracking and weight, so a role is one class rather than four.
- **Spacing / radius / elevation** — 4px base; radii capped at `2xl` with pills reserved for
  badges and toggles (§8); four layered shadows, plus a `glow` for charcoal cards.
- **Motion** — `fast/base/slow` durations, `standard`/`decelerate` easings, and nine keyframes
  (fade, scale, slide, rise, shimmer, spin).
- **Focus** — one `:focus-visible` treatment for the whole product: 2px primary ring, 2px
  offset. Previously there was none (finding A9).
- **Reduced motion** — durations collapse to 1ms and press-scale is suppressed, while opacity
  transitions survive so state stays legible (finding A13).

### 2. Typography wiring (`app/layout.tsx`)

Inter self-hosted via `next/font` (D-014) — verified in the served CSS, no external request.
Added the `viewport`/`themeColor` export that finding R6 flagged as missing.

### 3. Primitives (`components/ui/`, 16 files)

Vendored Radix + CVA per D-011 — we own every file.

| File | Notes |
|---|---|
| `button.tsx` | 5 variants × 3 sizes, `loading` state, defaults to `type="button"` |
| `icon-button.tsx` | `label` is a **required** prop — an icon-only control cannot ship unnamed |
| `field.tsx` | `Field` + `useFieldControl` — generates ids and wires label/hint/error |
| `input.tsx` | Input, Textarea, Select (native `<select>` on purpose — see below) |
| `switch.tsx`, `checkbox.tsx` | Radix; `SwitchField`/`CheckboxField` bundle a real label |
| `card.tsx`, `metric-card.tsx` | incl. the charcoal `inverse` surface from the reference |
| `badge.tsx`, `alert.tsx` | semantic tones, icon + text (never colour alone) |
| `dialog.tsx` | Dialog + `ConfirmDialog` for destructive actions (finding A12) |
| `drawer.tsx` | bottom sheet / side panel on Radix Dialog |
| `toast.tsx` | `ToastProvider` + `useToast`, mounted in the root layout |
| `save-state.tsx` | `Saving… → Saved ✓` in an aria-live region |
| `skeleton.tsx`, `empty-state.tsx`, `spinner.tsx` | loading and empty affordances |
| `index.ts` | the blessed public surface |

**`Field` is the important one.** UI-0 found that every form in the product uses
placeholders as labels (A1–A4, A14). `Field` makes the labelled, described, error-wired
version the *easy* path, so the broken pattern does not come back as pages are migrated.

**Select stays native.** A native `<select>` opens the OS picker, which is faster and more
familiar on the low-end Android hardware most Kenyan SMEs use, and is keyboard- and
screen-reader-correct with no JavaScript. A rich combobox can come later where search or
multi-select genuinely earns it. This also avoided a dependency.

### 4. Working lint, for the first time

`next lint` was removed in Next 16 and ESLint had never been installed. Now: ESLint 9 flat
config importing `eslint-config-next`'s native flat arrays, script `"lint": "eslint ."`.

`FlatCompat` was the initial approach and crashed with a circular-structure error —
`eslint-config-next` 16 already publishes flat configs, so the shim was both unnecessary and
harmful. `@eslint/eslintrc` was installed and then removed once that was clear.

### 5. Component test harness

`vitest.config.ts` keeps the fast `node` environment for lib tests and switches to `jsdom`
only for `*.test.tsx`, so the logic suite pays nothing for the DOM. Added RTL + jest-dom +
user-event, a setup file with `cleanup()`, and `matchMedia`/`ResizeObserver` stubs that Radix
overlays require in jsdom.

### 6. Slug reservations (`lib/reserved-slugs.ts`)

Added `analytics`, `insights`, `customers`, `leads`, `contacts`, `devices`, `nfc`, `tags`,
`cards`, `qr`, `team`, `members`, `notifications`, `integrations` (D-013). Free now; breaking
once a customer owns one.

---

## Defects found and fixed during the sprint

1. **`tailwind-merge` silently deleted font sizes.** It resolves conflicts using Tailwind's
   *default* scales, so it could not tell our custom `text-body-sm` (size) from
   `text-foreground` (colour), filed both in one group and dropped the earlier one. Every
   component combining a size and a colour would have rendered at the wrong size. Fixed by
   registering the custom scale via `extendTailwindMerge` in `lib/cn.ts`; caught by
   `lib/cn.test.ts` and locked with a regression test.
2. **Reduced motion would have broken modals.** The first cut used a blanket
   `[data-motion-transform] { transform: none }`, which would also cancel the Dialog's
   `-translate-x-1/2 -translate-y-1/2` centring and the Switch thumb's travel — throwing
   dialogs into the corner and hiding toggle state for reduced-motion users. Now scoped to
   `[data-motion-press]:active`.
3. **Two pre-existing lint errors** surfaced the moment linting worked, both in
   `components/public-profile.tsx`: an `<a>` to an internal route (now `next/link`), and
   `window.location.href =` assignment (now `.assign()`).

---

## Tests

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | **clean — first passing run in the project's history** |
| `npm test` | **77 passed** (39 pre-existing + 38 new), 13 files |
| `npm run build` | compiled successfully, all 19 routes intact |
| Runtime smoke | `/` `/login` `/privacy` return 200; `/dashboard` still 307s to `/login`; Inter, tokens, keyframes and utility classes confirmed in served CSS |

New tests cover the accessibility contracts specifically: `Field` label association,
`aria-describedby`, `aria-invalid` and unique ids; `Switch` role/keyboard operation;
`ConfirmDialog` accessible name, Escape, and confirm-vs-cancel; `MetricCard` never inventing
a trend it was not given.

---

## Not done, and why

- **No page was redesigned.** Sprint scope (CLAUDE.md §29 UI-1). The primitives exist and are
  tested but are not yet adopted by `app/`; migration happens in UI-2 onward.
- **Finding A5 (public profile's `<button>`-as-link) is still open.** The correct fix is
  semantic `<a>` elements, which belongs to the public-page rebuild in UI-4. Only the lint
  error was neutralised, with an inline note at the call site.
- **Tabs, Dropdown, Tooltip, Popover deferred to UI-2**, where the shell actually consumes
  them. Their Radix packages were deliberately not installed yet.
- `@vitejs/plugin-react` was **not** installed: it requires vite 8 while vitest 2.1.9 pins
  vite 5, and upgrading vitest would be an unrelated dependency bump. Vitest's esbuild
  transform plus `jsx: "react-jsx"` in tsconfig handles TSX without it.

## Dependencies added

**Runtime:** `@radix-ui/react-{dialog,switch,checkbox,toast}`, `class-variance-authority`,
`clsx`, `tailwind-merge`, `lucide-react`.
**Dev:** `eslint`, `eslint-config-next`, `jsdom`, `@testing-library/{react,dom,jest-dom,user-event}`.

## Technical debt

Carried forward from UI-0 and untouched this sprint: no error/loading/not-found boundaries;
`force-dynamic` on every dashboard route; `public-profile.tsx` fully client-rendered; `<img>`
instead of `next/image`; no `public/` directory or favicon; subscription expiry unenforced
(B13); `events.region` collected-never-written (B11).

New: `lib/cn.ts`'s custom font-size list must be updated whenever `tailwind.config.ts`
`fontSize` gains an entry, or that token will be dropped at merge time.

## Next sprint proposal — UI-2: Application Shell

Sidebar, topbar, mobile navigation, page headers, account menu, and the route moves to
`/dashboard/{profiles,devices,analytics,customers,settings}` with redirects from the old
paths. Adds Tabs/Dropdown/Tooltip/Popover. First sprint where pages adopt the primitives —
and where migrating forms to `Field` starts closing findings A1–A4. Backend: B10
(`accounts.profile` jsonb for business identity, migration `0007`). Must verify WCAG 2.4.11
Focus Not Obscured once the header becomes sticky.
