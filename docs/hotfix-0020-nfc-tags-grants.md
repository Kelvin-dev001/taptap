# Hotfix 0020 — column-level grants on `nfc_tags` (D-025)

**Status:** built, tested, **migration not applied**. 2026-09-19.
**Apply this before Sprint 8, not with it.**

Found by the Sprint 8 audit while checking how each `nfc_tags` consumer would treat a
placeholder identity. It is not a Sprint 8 problem; it is live today.

---

## What was open

`nfc_tags` has had a table-wide UPDATE policy for `authenticated` since `0005:28-33` and was
never given column-level grants. An RLS policy controls which **rows** a user may write, never
which **columns**, so this succeeded against any row the caller owned:

```
PATCH /rest/v1/nfc_tags?id=eq.<their own tag>
{"term_end": "2099-01-01"}
```

`account_live_identities` (`0019:78-90`) reads `status` and `term_end`. Both were writable. One
request therefore defeated:

| Rule | How |
|---|---|
| Renewal enforcement (D-018) | `term_end` pushed past any date we would ever check |
| The 14-day grace window (`0015:128`) | same |
| The publish slot count (D-022) | `status` flipped to `assigned`, or a term extended, adds a slot |

Every comparable table was given column grants as soon as it grew a write path — `accounts`
(`0007:38`), `leads` (`0012:59`), `orders` (`0017:147`), `smart_pages` (`0019:211`),
`quote_requests` (`0019:445`). This is the hole D-021 called "layer two is the one that was
missing", one table over, still open.

A second instance of the same class, fixed in the same migration: `replace_tag` (`0010:209-215`)
copied `smart_page_id` onto the replacement card and nothing else — no `kind`, no `term_start`,
no `term_end`. The replacement landed with `term_end` NULL, which `identity_is_live` treats as
live forever. Replacing a card turned a term that expires into one that does not.

---

## What changed

| File | Change |
|---|---|
| `supabase/migrations/0020_nfc_tags_column_grants.sql` | New. The grant, `rebind_tag()`, `set_tag_status()`, corrected `replace_tag()` |
| `app/dashboard/devices/actions.ts` | `rebindTagAction` and `setTagStatusAction` call the new RPCs instead of writing the table. `renameTagAction` unchanged — `label` is still a direct write |
| `lib/tag-write-enforcement.test.ts` | New. 21 assertions against the migration text, in the `lib/publish-enforcement.test.ts` style |
| `docs/decision-log.md`, `PROJECT.md` | D-025 |

No RLS policy was touched. The row half was never the problem.

**Verified:** 50 files / 632 tests pass (611 before, plus the 21 new), `tsc --noEmit` clean,
`eslint .` clean, `next build` succeeds.

---

## Applying it

Run **`0020_nfc_tags_column_grants.sql`** in the Supabase SQL editor, then deploy. Order matters
in that direction: the migration adds the two RPCs the deployed code will call, so applying
first means there is never a window where the app calls a function that does not exist. The
reverse order breaks repoint and disable for as long as it lasts.

### Checks to run afterwards

**1. The grant is narrow.** Should return exactly one row, `label`:

```sql
select column_name
from information_schema.column_privileges
where table_name = 'nfc_tags'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE';
```

**2. No table-level UPDATE survives.** Should return zero rows:

```sql
select privilege_type
from information_schema.table_privileges
where table_name = 'nfc_tags'
  and grantee = 'authenticated'
  and privilege_type in ('UPDATE', 'INSERT', 'DELETE');
```

**3. The functions exist and are definer:**

```sql
select proname, prosecdef
from pg_proc
where proname in ('rebind_tag', 'set_tag_status', 'replace_tag');
```

All three must show `prosecdef = true`.

**4. Nothing was silently granted itself a term while the hole was open.** Not proof, but worth
a look before it is closed for good — a term far past twelve months from its start deserves an
explanation:

```sql
select id, token, account_id, term_start, term_end
from nfc_tags
where term_end > term_start + interval '13 months'
order by term_end desc;
```

Expect zero rows. Anything here should be checked against the `payments` that paid for it.

### Then, by hand, on the Devices screen

1. **Repoint a card** at another published profile. It should work exactly as before.
2. **Repoint at a draft.** Nothing should change — the RPC refuses it, as the TypeScript check
   used to.
3. **Disable a card, then enable it.** Both directions.
4. **Rename a card.** This is the one path that still writes the table directly; it proves the
   grant did not go too far.
5. **Magangi's three cards must behave exactly as they do today.** They are the only real
   customer cards in production.

---

## Risks

- **`renameTagAction` is the canary.** If the grant were ever tightened further, renaming breaks
  silently — the action swallows the error and just revalidates. Worth surfacing that error at
  some point; out of scope for a permissions fix.
- **`rebind_tag` still re-enables a disabled card** as a side effect, because the Devices screen
  has always worked that way and a permissions fix is the wrong place to change what a button
  does. Flagged for Sprint 8, where stock state makes it worth revisiting.
- **Which tags `replace_tag` accepts is unchanged here.** It still takes any unowned token. That
  becomes a free-card route the moment stock cards carry a printed QR, and it closes in Sprint 8
  as D-027 — a product decision, not a fix.
- **`supabase/migrations/0016_renewal_reminders.sql` is still empty on disk** (113 lines at
  HEAD), left alone per instruction. It is applied in production, so nothing is broken, but a
  rebuild from migrations would silently omit renewal reminders.
