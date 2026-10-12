-- Hornbill TapTap — M5: the phones that get push notifications
--
-- (The plan numbered this 0032. 0033 was applied first, and the Supabase CLI
-- will not insert a migration below the newest applied one, so it is 0034.)
--
-- One row per phone: its Expo push token, whose phone it is, which business it
-- belongs to, and which kinds of notification it wants (docs/mobile/PLAN.md
-- §4.7). The phone registers itself after sign-in and removes itself at
-- sign-out; the web server reads the list when a lead arrives, a card is first
-- tapped, or a card's term is ending.
--
-- WHO decides what: the user comes from the session and the account from
-- `profiles`, never from the app. A token is unique: a phone that changes hands
-- moves to its new owner when they sign in, so the old owner's notifications
-- stop reaching it.
--
-- Push text never carries a customer's name or number (decided with Kelvin,
-- 12 Oct 2026, plan question 11); term reminders use the neutral wording of
-- PLAN.md §3 (question 12).

create table if not exists public.push_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  token        text not null unique,
  platform     text not null check (platform in ('android', 'ios')),
  app_version  text,
  locale       text,
  prefs        jsonb not null default '{"lead": true, "first_tap": true, "term": true}'::jsonb,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_devices_token_shape check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$')
);
create index if not exists push_devices_user_idx on public.push_devices(user_id);
create index if not exists push_devices_account_idx on public.push_devices(account_id);

alter table public.push_devices enable row level security;

-- Read your own phones. Writes go through the functions below only.
drop policy if exists push_devices_select_own on public.push_devices;
create policy push_devices_select_own on public.push_devices
  for select using (user_id = (select auth.uid()));

revoke insert, update, delete on public.push_devices from anon, authenticated;
revoke select on public.push_devices from anon;

/** The three switches a phone can have, each true or false. Anything else is refused. */
create or replace function public.push_prefs_valid(p_prefs jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p_prefs) = 'object'
     and not exists (
       select 1 from jsonb_each(p_prefs) e
       where e.key not in ('lead', 'first_tap', 'term')
          or jsonb_typeof(e.value) <> 'boolean'
     );
$$;

-- ---------------------------------------------------------------------------
-- The phone's side
-- ---------------------------------------------------------------------------
create or replace function public.register_push_device(
  p_token       text,
  p_platform    text,
  p_app_version text default null,
  p_locale      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_account uuid;
  v_prefs   jsonb;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  select account_id into v_account from public.profiles where id = v_user;
  if v_account is null then raise exception 'no account'; end if;

  insert into public.push_devices (user_id, account_id, token, platform, app_version, locale)
  values (v_user, v_account, p_token, p_platform, left(p_app_version, 32), left(p_locale, 16))
  on conflict (token) do update
     set user_id      = excluded.user_id,
         account_id   = excluded.account_id,
         platform     = excluded.platform,
         app_version  = excluded.app_version,
         locale       = excluded.locale,
         -- A phone that changed hands starts with the defaults, not the last
         -- owner's choices.
         prefs        = case when public.push_devices.user_id = excluded.user_id
                             then public.push_devices.prefs
                             else excluded.prefs end,
         last_seen_at = now()
  returning prefs into v_prefs;

  return jsonb_build_object('prefs', v_prefs);
end;
$$;

create or replace function public.unregister_push_device(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_devices where token = p_token and user_id = auth.uid();
$$;

create or replace function public.set_push_prefs(p_token text, p_prefs jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs jsonb;
begin
  if not public.push_prefs_valid(p_prefs) then raise exception 'invalid prefs'; end if;
  update public.push_devices
     set prefs = prefs || p_prefs
   where token = p_token and user_id = auth.uid()
  returning prefs into v_prefs;
  if v_prefs is null then raise exception 'device not found'; end if;
  return jsonb_build_object('prefs', v_prefs);
end;
$$;

revoke execute on function public.register_push_device(text, text, text, text) from public, anon;
revoke execute on function public.unregister_push_device(text) from public, anon;
revoke execute on function public.set_push_prefs(text, jsonb) from public, anon;
grant execute on function public.register_push_device(text, text, text, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;
grant execute on function public.set_push_prefs(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The server's side (service role only)
-- ---------------------------------------------------------------------------
-- Tokens of every phone on the account that wants this kind of notification.
create or replace function public.push_targets(p_account_id uuid, p_kind text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(token order by last_seen_at desc), '{}')
  from public.push_devices
  where account_id = p_account_id
    and coalesce((prefs ->> p_kind)::boolean, true);
$$;

-- Expo says these phones are gone (the app was removed): stop sending to them.
create or replace function public.forget_push_tokens(p_tokens text[])
returns int
language sql
security definer
set search_path = public
as $$
  with gone as (delete from public.push_devices where token = any(p_tokens) returning 1)
  select count(*)::int from gone;
$$;

revoke execute on function public.push_targets(uuid, text) from public, anon, authenticated;
revoke execute on function public.forget_push_tokens(text[]) from public, anon, authenticated;
grant execute on function public.push_targets(uuid, text) to service_role;
grant execute on function public.forget_push_tokens(text[]) to service_role;
