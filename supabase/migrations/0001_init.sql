-- Hornbill TapTap — Sprint 1 Foundations schema
-- Multi-tenant by account_id, isolated with Row-Level Security (RLS).
-- Public tap/redirect path uses SECURITY DEFINER RPCs so tenant tables are
-- never directly exposed to anonymous clients.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        text not null default 'free',
  created_at  timestamptz not null default now()
);

-- Links a Supabase auth user to an account. v1 = one user per account.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now()
);
create index if not exists profiles_account_id_idx on public.profiles(account_id);

-- The one engine: a permanent slug that renders a page or redirects.
create table if not exists public.smart_pages (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts(id) on delete cascade,
  slug         text not null unique,
  title        text,
  mode         text not null default 'redirect' check (mode in ('page', 'redirect')),
  redirect_url text,
  config       jsonb not null default '{}'::jsonb,
  theme        jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- slugs are stored lowercased; enforce it at the DB level too
  constraint smart_pages_slug_lowercase check (slug = lower(slug))
);
create index if not exists smart_pages_account_id_idx on public.smart_pages(account_id);

-- Individual actions/buttons for page mode.
create table if not exists public.links (
  id            uuid primary key default gen_random_uuid(),
  smart_page_id uuid not null references public.smart_pages(id) on delete cascade,
  type          text not null,
  label         text,
  value         text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists links_smart_page_id_idx on public.links(smart_page_id);

-- Append-only analytics events (high volume -> bigint identity PK).
create table if not exists public.events (
  id            bigint generated always as identity primary key,
  smart_page_id uuid not null references public.smart_pages(id) on delete cascade,
  type          text not null check (type in ('tap', 'scan', 'view', 'click')),
  link_id       uuid references public.links(id) on delete set null,
  device        text,
  os            text,
  country       text,
  region        text,
  referrer      text,
  ts            timestamptz not null default now()
);
create index if not exists events_smart_page_ts_idx on public.events(smart_page_id, ts);

-- Subscription stub (fleshed out in Sprint 4 — Billing).
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null unique references public.accounts(id) on delete cascade,
  plan               text not null default 'free',
  status             text not null default 'active',
  provider           text,
  current_period_end timestamptz,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists smart_pages_set_updated_at on public.smart_pages;
create trigger smart_pages_set_updated_at
  before update on public.smart_pages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-provision an account + profile when a new auth user signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id uuid;
begin
  insert into public.accounts (name)
  values (coalesce(split_part(new.email, '@', 1), 'My business'))
  returning id into new_account_id;

  insert into public.profiles (id, account_id, full_name)
  values (new.id, new_account_id, new.raw_user_meta_data ->> 'full_name');

  insert into public.subscriptions (account_id, plan, status)
  values (new_account_id, 'free', 'active');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Public RPCs for the tap/redirect path (no direct table exposure to anon)
-- ---------------------------------------------------------------------------

-- Resolve a slug to its (active) destination. Returns 0 or 1 rows.
create or replace function public.resolve_slug(p_slug text)
returns table (id uuid, mode text, redirect_url text)
language sql
security definer
set search_path = public
as $$
  select sp.id, sp.mode, sp.redirect_url
  from public.smart_pages sp
  where sp.slug = lower(p_slug)
    and sp.is_active = true
  limit 1;
$$;

-- Log a public interaction event.
create or replace function public.log_event(
  p_page_id  uuid,
  p_type     text,
  p_link_id  uuid default null,
  p_device   text default null,
  p_os       text default null,
  p_country  text default null,
  p_region   text default null,
  p_referrer text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type not in ('tap', 'scan', 'view', 'click') then
    raise exception 'invalid event type: %', p_type;
  end if;

  insert into public.events (smart_page_id, type, link_id, device, os, country, region, referrer)
  values (p_page_id, p_type, p_link_id, p_device, p_os, p_country, p_region, p_referrer);
end;
$$;

grant execute on function public.resolve_slug(text) to anon, authenticated;
grant execute on function public.log_event(uuid, text, uuid, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.accounts      enable row level security;
alter table public.profiles      enable row level security;
alter table public.smart_pages   enable row level security;
alter table public.links         enable row level security;
alter table public.events        enable row level security;
alter table public.subscriptions enable row level security;

-- Helper: the set of account_ids the current user belongs to.
-- (Inlined as subqueries below to keep policies self-contained.)

-- accounts: owner can read/update their own account
create policy accounts_select_own on public.accounts
  for select using (
    id in (select account_id from public.profiles where id = auth.uid())
  );
create policy accounts_update_own on public.accounts
  for update using (
    id in (select account_id from public.profiles where id = auth.uid())
  );

-- profiles: a user sees/updates only their own profile row
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

-- smart_pages: full CRUD limited to the owner's account
create policy smart_pages_all_own on public.smart_pages
  for all using (
    account_id in (select account_id from public.profiles where id = auth.uid())
  ) with check (
    account_id in (select account_id from public.profiles where id = auth.uid())
  );

-- links: manage links for pages in the owner's account
create policy links_all_own on public.links
  for all using (
    smart_page_id in (
      select sp.id from public.smart_pages sp
      where sp.account_id in (select account_id from public.profiles where id = auth.uid())
    )
  ) with check (
    smart_page_id in (
      select sp.id from public.smart_pages sp
      where sp.account_id in (select account_id from public.profiles where id = auth.uid())
    )
  );

-- events: owner can read events for their pages (writes go through log_event RPC)
create policy events_select_own on public.events
  for select using (
    smart_page_id in (
      select sp.id from public.smart_pages sp
      where sp.account_id in (select account_id from public.profiles where id = auth.uid())
    )
  );

-- subscriptions: owner can read their subscription
create policy subscriptions_select_own on public.subscriptions
  for select using (
    account_id in (select account_id from public.profiles where id = auth.uid())
  );
