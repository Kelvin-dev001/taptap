-- Hornbill TapTap — Sprint UI-13: lead notifications (audit item B14)
--
-- The gap this closes, open since the original feature list: a lead arrives and
-- nobody is told. The owner has to open the dashboard to discover it. The first
-- paying customer received a lead that went unseen, which is the whole value of
-- lead capture evaporating at the last step.
--
-- Scope is deliberately one channel and one event: email, on a new lead. The
-- in-app bell, digests and expiry warnings are separate problems with separate
-- decisions behind them.

-- ---------------------------------------------------------------------------
-- 1) Preferences — a column, not a corner of accounts.profile
-- ---------------------------------------------------------------------------
-- saveBusinessProfileAction writes `profile` WHOLESALE (`update({ name, profile })`),
-- so anything stored inside it is destroyed the next time someone saves their
-- business details. Preferences kept there would work until the first Settings
-- save and then silently stop — the worst kind of failure, because nothing
-- errors and notifications simply stop arriving.
--
-- A separate column makes that structurally impossible rather than relying on
-- every future writer remembering to merge.
--
-- Shape:  { "lead": { "enabled": bool, "to": text|null } }
--         `to` null means "the owner's verified sign-up address".
alter table public.accounts
  add column if not exists notify jsonb not null default '{}'::jsonb;

-- Column grants again (see 0007): a policy governs which ROWS, never which
-- COLUMNS, so `notify` has to be added to the grant or the Settings form cannot
-- write it.
revoke update on public.accounts from authenticated;
grant update (name, profile, notify) on public.accounts to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Delivery log — the idempotency key, and the honesty record
-- ---------------------------------------------------------------------------
-- Two jobs:
--
--   Idempotency. `unique (kind, ref_id, channel)` means a retry, a double
--   submit, or a re-run physically cannot email the same lead twice. Enforcing
--   it in the database rather than in application code means it holds even if
--   two requests race.
--
--   Honesty. §15 forbids claiming outcomes we cannot observe. We know what the
--   provider accepted, not what a human read, so this records exactly that:
--   'sent' with the provider's id, or 'failed' with its error. Never "sent"
--   because we tried.
create table if not exists public.notification_deliveries (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  kind        text not null,              -- 'lead'
  ref_id      uuid not null,              -- leads.id
  channel     text not null,              -- 'email'
  status      text not null check (status in ('sent', 'failed')),
  provider_id text,                       -- Resend message id, when accepted
  error       text,
  created_at  timestamptz not null default now(),
  constraint notification_deliveries_once unique (kind, ref_id, channel)
);
create index if not exists notification_deliveries_account_idx
  on public.notification_deliveries(account_id, created_at desc);

alter table public.notification_deliveries enable row level security;

-- Owners may read their own delivery history so "did it send?" is answerable.
-- Writes are service-role only: this is a record of what the system did, and an
-- owner editing it would make it worthless as evidence.
drop policy if exists notification_deliveries_select_own on public.notification_deliveries;
create policy notification_deliveries_select_own on public.notification_deliveries
  for select using (
    account_id in (select account_id from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3) submit_lead now returns the new lead's id
-- ---------------------------------------------------------------------------
-- Without an id there is nothing to key idempotency to, and the only
-- alternative — re-reading the newest lead for the page — races with any
-- concurrent submission and would occasionally notify about the wrong person.
--
-- The return type changes, so CREATE OR REPLACE cannot be used; the function is
-- dropped and recreated, and the grant reapplied. Behaviour is otherwise
-- identical to 0003.
drop function if exists public.submit_lead(uuid, text, text, text, text, text, jsonb);

create function public.submit_lead(
  p_page_id uuid,
  p_name    text default null,
  p_phone   text default null,
  p_email   text default null,
  p_company text default null,
  p_message text default null,
  p_meta    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
  v_lead_id uuid;
begin
  select is_active into v_active from public.smart_pages where id = p_page_id;
  if v_active is not true then
    raise exception 'page not found or inactive';
  end if;

  if coalesce(p_name, '') = ''
     and coalesce(p_phone, '') = ''
     and coalesce(p_email, '') = '' then
    raise exception 'lead requires at least a name, phone, or email';
  end if;

  insert into public.leads (smart_page_id, name, phone, email, company, message, meta)
  values (
    p_page_id,
    nullif(p_name, ''),
    nullif(p_phone, ''),
    nullif(p_email, ''),
    nullif(p_company, ''),
    nullif(p_message, ''),
    coalesce(p_meta, '{}'::jsonb)
  )
  returning id into v_lead_id;

  insert into public.events (smart_page_id, type) values (p_page_id, 'lead');

  return v_lead_id;
end;
$$;

grant execute on function public.submit_lead(uuid, text, text, text, text, text, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Everything needed to compose one notification, in one call
-- ---------------------------------------------------------------------------
-- Returns the lead, the business, and the address to notify — including the
-- owner's sign-up address from auth.users, which is not otherwise reachable.
--
-- SECURITY: this returns a customer's personal data and the owner's email
-- keyed only by a lead id, so it must never be callable by anon. PostgreSQL
-- grants EXECUTE to PUBLIC by default, which would do exactly that, so the
-- default grant is revoked explicitly before granting to service_role alone.
create or replace function public.lead_notification_target(p_lead_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'accountId',    a.id,
    'businessName', a.name,
    'notify',       a.notify,
    'slug',         sp.slug,
    'pageTitle',    sp.title,
    -- The account's first member is its owner (D-017: one account, members
    -- deferred). Their sign-up address is verified, which is why it is the
    -- default recipient.
    'ownerEmail', (
      select u.email
      from auth.users u
      join public.profiles pr on pr.id = u.id
      where pr.account_id = a.id
      order by pr.created_at
      limit 1
    ),
    'lead', jsonb_build_object(
      'id',        l.id,
      'name',      l.name,
      'phone',     l.phone,
      'email',     l.email,
      'company',   l.company,
      'message',   l.message,
      'createdAt', l.created_at
    )
  )
  from public.leads l
  join public.smart_pages sp on sp.id = l.smart_page_id
  join public.accounts a     on a.id  = sp.account_id
  where l.id = p_lead_id;
$$;

revoke execute on function public.lead_notification_target(uuid) from public;
revoke execute on function public.lead_notification_target(uuid) from anon;
revoke execute on function public.lead_notification_target(uuid) from authenticated;
grant execute on function public.lead_notification_target(uuid) to service_role;
