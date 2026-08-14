-- Hornbill TapTap — Sprint UI-2: business identity on the account (audit item B10)
--
-- WHY: account provisioning names the business after the email local-part
-- ("kelvin@…" -> "kelvin") and captures nothing else, so the app shell has no
-- real business name to show and onboarding has nowhere to put a logo, category,
-- location or contact details. The Settings screen added in UI-2 needs a home
-- for those fields.
--
-- WHY jsonb rather than columns: this set is still moving (UI-2 captures the
-- basics; onboarding in a later sprint may add more). A single jsonb keeps
-- additions migration-free, matching the existing `smart_pages.config` pattern.
-- Anything that later needs indexing or constraints can be promoted to a column.
--
-- Shape (all optional):
--   { "category": text, "logoUrl": text, "location": text, "phone": text,
--     "whatsapp": text, "website": text, "googleReviewUrl": text }
-- The business NAME stays in accounts.name — it already exists and is the value
-- the signup trigger populates.

alter table public.accounts
  add column if not exists profile jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Tighten write access now that the UI writes to this table
-- ---------------------------------------------------------------------------
-- Until now nothing in the product updated `accounts`, so the permissive
-- `accounts_update_own` policy was harmless. The Settings form changes that.
--
-- An RLS policy controls WHICH ROWS a user may write, never WHICH COLUMNS, so
-- policy alone would let a signed-in user update any column on their own
-- account row — including `accounts.plan`. That column is vestigial (plan
-- gating reads subscriptions.plan_code, and the M-Pesa callback writes both via
-- the service role), so this is not a live escalation path today, but leaving it
-- writable while introducing a write path is how one gets created later.
--
-- Column-level grants are the correct tool.
revoke update on public.accounts from authenticated;
grant update (name, profile) on public.accounts to authenticated;

-- Add the WITH CHECK half so the row cannot be rewritten to another account.
drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own on public.accounts
  for update using (
    id in (select account_id from public.profiles where id = auth.uid())
  ) with check (
    id in (select account_id from public.profiles where id = auth.uid())
  );

-- Note: the signup trigger (handle_new_user) is SECURITY DEFINER and the M-Pesa
-- callback uses the service role, so neither is affected by the grant change.
