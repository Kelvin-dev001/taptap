-- Hornbill TapTap — Sprint 7: purchase-gated activation (D-021 … D-024)
--
-- WHY: `smart_pages.status` has defaulted to 'published' since 0009, so a
-- profile created thirty seconds after signup resolves publicly at its slug,
-- forever, for free. D-018 made that deliberate ("free means free" — building
-- and publishing a profile costs nothing). D-021 revises exactly that clause:
-- a profile can still be BUILT for nothing, but it goes LIVE only against a paid
-- identity.
--
-- Four layers of enforcement, because each closes what the one above cannot:
--
--   1. publish_page() checks entitlement            — the normal path
--   2. column grants stop a direct PostgREST write  — the bypass path
--   3. a trigger holds even against the service role— our own future mistakes
--   4. page_is_live() decides what the public sees  — the read path
--
-- Layer 2 is the one that was missing entirely. `authenticated` has held a
-- table-wide UPDATE grant on `smart_pages` since 0001, so until now
-- `PATCH /rest/v1/smart_pages {"status":"published"}` would have published
-- anything the caller owned, whatever publish_page() said. 0007 solved this same
-- class of problem on `accounts` with column-level grants; smart_pages never got
-- the same treatment.
--
-- NOTHING IS UNPUBLISHED BY THIS MIGRATION. Every page that is live when it runs
-- is flagged grandfathered and stays live permanently. See section 2.

-- ---------------------------------------------------------------------------
-- 1) The grandfathering flag
-- ---------------------------------------------------------------------------
-- A stored fact on the page rather than a derived "created before date X" rule.
-- A date rule has to be re-argued every time someone reads it, cannot survive a
-- backfill of historical rows, and gives no way to answer "is this page
-- grandfathered" with a SELECT. A boolean does.
--
-- Per PAGE, not per account: a customer who was live before the cutover keeps
-- the page they had. Their NEXT profile is a draft like everyone else's, or
-- grandfathering would quietly become an unlimited free tier for early accounts.
alter table public.smart_pages
  add column if not exists entitlement_grandfathered boolean not null default false;

comment on column public.smart_pages.entitlement_grandfathered is
  'Set by migration 0019 for every page that was already published at the '
  'cutover. Such a page publishes and resolves without consuming an identity '
  'slot, permanently. Never set for pages created afterwards.';

-- ---------------------------------------------------------------------------
-- 2) Grandfathering backfill — run BEFORE any gate exists
-- ---------------------------------------------------------------------------
-- The single most important statement in this file. Ordering is deliberate: the
-- trigger in section 7 is created after this, so this cannot be refused by the
-- rule it is exempting people from.
--
-- OPERATOR CHECK, immediately after applying this migration:
--   select count(*) from public.smart_pages
--    where status = 'published' and entitlement_grandfathered = false;
-- Expect 0. Anything else means a page went live between the backfill and the
-- gate, and should be flagged by hand.
update public.smart_pages
  set entitlement_grandfathered = true
  where status = 'published';

-- New pages are born private. This is the change customers actually feel, and
-- it only affects rows created from here on.
alter table public.smart_pages
  alter column status set default 'draft';

-- ---------------------------------------------------------------------------
-- 3) How many identities an account still owns
-- ---------------------------------------------------------------------------
-- Mirrors activeIdentityCount() in lib/identity.ts exactly: claimed, not
-- switched off, and inside its term plus grace. Both are stated because both are
-- enforced — the TypeScript decides what the UI offers, this decides what the
-- database permits, and they must agree.
--
-- identity_is_live() (0015) treats a NULL term_end as live. That fail-open is
-- load-bearing here: an identity whose term was never recorded must not cost
-- someone their published page.
create or replace function public.account_live_identities(p_account uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.nfc_tags t
  where t.account_id = p_account
    and t.status <> 'disabled'
    and public.identity_is_live(t.term_end);
$$;

-- ---------------------------------------------------------------------------
-- 4) May this page be published?
-- ---------------------------------------------------------------------------
-- Publishing consumes a SLOT, and slots come from live identities.
--
-- Counting identities rather than binding one to the page (nfc_tags.smart_page_id)
-- was a deliberate choice, D-022. provision_identities() gives a paying customer
-- live identity rows weeks before the physical card is produced, so a binding
-- rule would make publishing wait on manufacturing — the delay the customer is
-- paying to skip. And repointing a card without re-encoding it is the core
-- product promise (D-009): if the binding carried the entitlement, every repoint
-- would silently move who is allowed to be live.
create or replace function public.page_publish_allowed(p_page_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_account        uuid;
  v_grandfathered  boolean;
  v_status         text;
  v_used           int;
begin
  select account_id, entitlement_grandfathered, status
    into v_account, v_grandfathered, v_status
  from public.smart_pages
  where id = p_page_id;

  -- Unknown page: refuse. "Cannot tell" is never a reason to allow.
  if v_account is null then
    return false;
  end if;

  if v_grandfathered then
    return true;
  end if;

  -- Re-publishing something already live must always work. It holds a slot it
  -- has already been granted, and refusing would strand an owner mid-edit.
  if v_status = 'published' then
    return true;
  end if;

  select count(*)::int into v_used
  from public.smart_pages sp
  where sp.account_id = v_account
    and sp.status = 'published'
    and sp.entitlement_grandfathered = false
    and sp.id <> p_page_id;

  return v_used < public.account_live_identities(v_account);
end;
$$;
grant execute on function public.page_publish_allowed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) publish_page enforces it
-- ---------------------------------------------------------------------------
-- The error code is matched in TypeScript (lib/entitlement.ts), so the checkout
-- can be opened rather than a raw Postgres exception being shown to an owner.
create or replace function public.publish_page(p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  if not exists (
    select 1 from public.smart_pages
    where id = p_page_id and account_id = v_account
  ) then
    raise exception 'page not found';
  end if;

  if not public.page_publish_allowed(p_page_id) then
    raise exception 'insufficient_entitlement'
      using hint = 'Publishing needs an available Smart Card or Smart Stand.';
  end if;

  update public.smart_pages
    set published_content = public.build_page_snapshot(p_page_id),
        status = 'published',
        published_at = now()
    where id = p_page_id;

  return jsonb_build_object('ok', true, 'published_at', now());
end;
$$;
grant execute on function public.publish_page(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Column grants — a client cannot publish by calling the API directly
-- ---------------------------------------------------------------------------
-- An RLS policy controls WHICH ROWS a user may write, never WHICH COLUMNS. The
-- existing smart_pages_*_own policies are correct and untouched; what was
-- missing is the column half, exactly as 0007 established for `accounts` and
-- 0012 for `leads`.
--
-- After this, `status`, `published_at`, `published_content` and
-- `entitlement_grandfathered` are writable only through the SECURITY DEFINER
-- RPCs above and by the service role. An INSERT that omits `status` takes the
-- 'draft' default from section 2.
--
-- Verified against every writer in the app before narrowing:
--   savePageAction        -> title, mode, redirect_url, config, theme
--   setProfileActiveAction-> is_active
--   createProfileAction   -> account_id, slug, title, mode, redirect_url, config
revoke insert, update on public.smart_pages from authenticated;

grant insert (account_id, slug, title, mode, redirect_url, config, theme)
  on public.smart_pages to authenticated;

grant update (title, mode, redirect_url, config, theme, is_active, updated_at)
  on public.smart_pages to authenticated;

-- ---------------------------------------------------------------------------
-- 7) The trigger — belt and braces, including against ourselves
-- ---------------------------------------------------------------------------
-- Sections 5 and 6 together are sufficient for today's code. This is for
-- tomorrow's: a future admin path, a service-role script, or a bug in the RPC.
-- The same reasoning as 0017's order_events trigger — a rule that cannot be
-- bypassed is worth more than one every future caller has to remember.
--
-- A no-op when published_content is refreshed on an already-published page,
-- because the status is not transitioning.
create or replace function public.enforce_publish_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    -- Reads the OLD row (this is BEFORE UPDATE), so the slot count excludes the
    -- page being published. That is what makes the arithmetic correct.
    if not public.page_publish_allowed(new.id) then
      raise exception 'insufficient_entitlement'
        using hint = 'Publishing needs an available Smart Card or Smart Stand.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists smart_pages_enforce_publish on public.smart_pages;
create trigger smart_pages_enforce_publish
  before update on public.smart_pages
  for each row execute function public.enforce_publish_entitlement();

-- Deliberately UPDATE-only. On INSERT the row does not exist yet, so
-- page_publish_allowed() has nothing to read and would refuse every insert. The
-- insert path is closed by the column grant in section 6 instead: `status` is
-- not grantable to authenticated, so a client insert always takes the 'draft'
-- default. Nothing in the app inserts a published page.

-- ---------------------------------------------------------------------------
-- 8) What the public sees
-- ---------------------------------------------------------------------------
-- 0015 said: "A page with NO identities is live: building and publishing a
-- profile is free". D-021 inverts precisely that sentence.
--
-- Ordering by published_at is load-bearing. When an account with two cards lets
-- one lapse, WHICH of its two pages goes dark must be a fact rather than a race.
-- Oldest-published wins, because that is the one most likely to already be
-- printed on something.
--
-- This subsumes the old per-tag rule, and changes one behaviour worth naming:
-- previously a page whose own bound card had lapsed went dark even when the
-- account held another live card. Now the account's slot count decides, so that
-- page stays live and a different one goes dark instead. The lapsed PHYSICAL
-- card still fails correctly at /t/<token>, because resolve_tag checks
-- identity_is_live() on the tag itself and that is unchanged.
create or replace function public.page_is_live(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with page as (
    select id, account_id, entitlement_grandfathered, status,
           coalesce(published_at, created_at) as at
    from public.smart_pages
    where id = p_page_id
  )
  select case
    when not exists (select 1 from page) then false
    when (select entitlement_grandfathered from page) then true
    when (select status from page) is distinct from 'published' then false
    else (
      select (
        -- The page's own 1-based rank among its account's published,
        -- non-grandfathered pages. The row itself is included by the `id <=`
        -- tie-break, so a page ranked 1 needs 1 slot.
        select count(*)
        from public.smart_pages sp, page p
        where sp.account_id = p.account_id
          and sp.status = 'published'
          and sp.entitlement_grandfathered = false
          and (
            coalesce(sp.published_at, sp.created_at) < p.at
            or (coalesce(sp.published_at, sp.created_at) = p.at and sp.id <= p.id)
          )
      ) <= public.account_live_identities((select account_id from page))
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- 9) A card cannot be claimed to a draft
-- ---------------------------------------------------------------------------
-- Binding a physical card to a page that does not resolve produces a card that
-- appears set up and does nothing. The distinguishable message lets the claim
-- screen open checkout instead of showing a raw exception.
create or replace function public.claim_tag(p_token text, p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_tag public.nfc_tags%rowtype;
  v_page_status text;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  select * into v_tag from public.nfc_tags where token = p_token for update;
  if v_tag.id is null then raise exception 'tag not found'; end if;
  if v_tag.status = 'disabled' then raise exception 'tag is disabled'; end if;
  if v_tag.account_id is not null and v_tag.account_id <> v_account then
    raise exception 'tag already claimed';
  end if;

  select status into v_page_status
  from public.smart_pages
  where id = p_page_id and account_id = v_account;

  if v_page_status is null then raise exception 'page not found'; end if;
  if v_page_status <> 'published' then
    raise exception 'page_not_published'
      using hint = 'Publish this profile before linking a card to it.';
  end if;

  update public.nfc_tags
    set account_id = v_account,
        smart_page_id = p_page_id,
        status = 'assigned',
        claimed_at = coalesce(claimed_at, now())
    where id = v_tag.id;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.claim_tag(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) Entitlements no longer read a stored segment (D-024)
-- ---------------------------------------------------------------------------
-- Individual / Business / Corporate are marketing packaging on the pricing page.
-- With the free tier gone there is exactly one axis left — does this account
-- hold a live identity — so a per-segment feature gate is not merely unwanted,
-- it is unimplementable without storing the segment.
--
-- `accounts.segment` is deliberately NOT dropped here. Dropping a column in the
-- same migration that changes entitlement means a rollback loses data; it goes
-- in a later cleanup once this has proven itself, exactly as D-018 left
-- `subscriptions` alone.
create or replace function public.account_has_custom_branding(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nfc_tags t
    where t.account_id = p_account
      and t.status <> 'disabled'
      and public.identity_is_live(t.term_end)
  );
$$;

-- ---------------------------------------------------------------------------
-- 11) Offline payments carry who recorded them
-- ---------------------------------------------------------------------------
-- Staff can record a cash, bank or in-person payment against an order, which
-- provisions identities through the SAME path as an M-Pesa callback. That is a
-- privileged act over money, so it must name the person who performed it.
--
-- `payments` has no UPDATE policy for `authenticated` and rows are written only
-- by the service role (0004), so a row is append-only in practice and these two
-- columns are the audit record. The fulfilment moves that follow are recorded by
-- the order_events trigger (0017) as before.
alter table public.payments
  add column if not exists recorded_by uuid references auth.users(id) on delete set null;

alter table public.payments
  add column if not exists recorded_at timestamptz;

comment on column public.payments.recorded_by is
  'Staff user who recorded this payment offline. NULL for M-Pesa payments, '
  'which are recorded by Safaricom''s callback rather than by a person.';

-- ---------------------------------------------------------------------------
-- 12) Corporate quote requests
-- ---------------------------------------------------------------------------
-- A thirty-identity buyer must not be pushed through a self-serve checkout that
-- caps at 20 and asks for one M-Pesa number. This is the sales-led door.
create table if not exists public.quote_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  company    text,
  email      text,
  phone      text,
  quantity   int check (quantity is null or quantity > 0),
  notes      text,
  status     text not null default 'new'
             check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  -- Nullable: most enquiries arrive from the public pricing page, before the
  -- person has an account. Linked when a signed-in user submits one.
  account_id uuid references public.accounts(id) on delete set null,
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists quote_requests_status_idx
  on public.quote_requests(status, created_at desc);

alter table public.quote_requests enable row level security;

-- Staff only. There is no owner-read policy because a quote request has no
-- owner yet, and no public read because it holds a stranger's contact details.
drop policy if exists quote_requests_select_staff on public.quote_requests;
create policy quote_requests_select_staff on public.quote_requests
  for select using (public.is_staff());

drop policy if exists quote_requests_update_staff on public.quote_requests;
create policy quote_requests_update_staff on public.quote_requests
  for update using (public.is_staff()) with check (public.is_staff());

-- Column grants, same reasoning as orders (0017): staff work the request, and
-- can never rewrite what the enquirer actually said.
revoke update on public.quote_requests from authenticated;
grant update (status, handled_by, handled_at) on public.quote_requests to authenticated;

-- No INSERT policy at all. Submissions arrive through the SECURITY DEFINER
-- function below, mirroring submit_lead (0014) — that keeps the table
-- unreachable to anon while still accepting a public form, and puts validation
-- somewhere a client cannot skip.
create or replace function public.submit_quote_request(
  p_name     text,
  p_company  text default null,
  p_email    text default null,
  p_phone    text default null,
  p_quantity int  default null,
  p_notes    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_account uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'a name is required';
  end if;
  if coalesce(trim(p_email), '') = '' and coalesce(trim(p_phone), '') = '' then
    raise exception 'an email address or phone number is required';
  end if;

  -- Present only when a signed-in customer asks for a quote; anonymous
  -- enquiries from the pricing page simply have no account to link.
  select account_id into v_account from public.profiles where id = auth.uid();

  insert into public.quote_requests
    (name, company, email, phone, quantity, notes, account_id)
  values (
    left(trim(p_name), 200),
    nullif(left(trim(coalesce(p_company, '')), 200), ''),
    nullif(left(trim(coalesce(p_email, '')), 200), ''),
    nullif(left(trim(coalesce(p_phone, '')), 40), ''),
    case when p_quantity is null or p_quantity < 1 then null
         else least(p_quantity, 100000) end,
    nullif(left(trim(coalesce(p_notes, '')), 4000), ''),
    v_account
  )
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.submit_quote_request(text, text, text, text, int, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 13) Signup stops writing a "free" plan
-- ---------------------------------------------------------------------------
-- The last live free-tier remnant. `subscriptions` has not been read by the app
-- since D-018, but handle_new_user() still wrote plan='free' for every new
-- account — a row asserting a plan that no longer exists, on a table nothing
-- consults. The table and its existing rows are left alone; only the write of
-- new ones stops.
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

  return new;
end;
$$;
