-- Hornbill TapTap — Sprint 6b: order-to-cash (D-019)
--
-- WHY: 0015 priced hardware and built no way to buy it, so every card sold is a
-- manual conversation followed by an untracked production job. The Order becomes
-- the spine: a customer creates it, payment confirms it and provisions the
-- identity, and staff fulfil it.
--
-- Scope here is the customer-facing half. The staff console (Kanban, order
-- table, metrics) is Sprint 6c and builds on these tables.

-- ---------------------------------------------------------------------------
-- 1) Staff — internal Hornbill people, NOT account members
-- ---------------------------------------------------------------------------
-- Deliberately its own table rather than `profiles.role`. D-017 settled that a
-- business is one account with many members, and reserves a per-account role for
-- team management. Hornbill's own staff are a different axis entirely: they are
-- not members of any customer account, and conflating the two would poison that
-- design before it is built.
--
-- This also replaces the shared ADMIN_TOKEN for anything multi-user. That gate
-- is a single secret with no identity, so "who moved this order" is unanswerable
-- under it — which makes an audit log impossible.
create table if not exists public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'ops' check (role in ('ops', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- SECURITY DEFINER so it does not re-enter `staff` RLS and recurse. Every ops
-- policy below is written in terms of this one function, so the definition of
-- "is staff" lives in exactly one place.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid());
$$;
grant execute on function public.is_staff() to authenticated;

-- Staff can see the roster. Nobody writes it through the API — granting staff is
-- a deliberate act performed in SQL, because a table that can grant its own
-- membership is a privilege-escalation waiting to happen.
drop policy if exists staff_select_staff on public.staff;
create policy staff_select_staff on public.staff
  for select using (public.is_staff());

-- ---------------------------------------------------------------------------
-- 2) Products — the catalogue, WITHOUT prices
-- ---------------------------------------------------------------------------
-- No price column, deliberately. `lib/pricing.ts` is the single source of truth
-- for money (D-018) and a second copy in the database is a second number that
-- can be wrong — with the wrong one silently winning at checkout. What a row
-- actually carries is catalogue metadata: what exists, what it is called, and
-- whether it can still be ordered.
--
-- Historical price integrity is handled where it belongs: `orders.amount_kes`
-- records what was actually charged, so changing a price never rewrites history.
create table if not exists public.products (
  code           text primary key,
  name           text not null,
  kind           text not null check (kind in ('card', 'stand')),
  bundled_months int  not null default 12 check (bundled_months >= 0),
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

insert into public.products (code, name, kind, bundled_months, sort_order)
values
  ('smart_card',  'Smart Card',  'card',  12, 1),
  ('smart_stand', 'Smart Stand', 'stand', 12, 2)
on conflict (code) do nothing;

alter table public.products enable row level security;

-- Ordering requires signing in (D-019), so the catalogue is not public.
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3) Orders
-- ---------------------------------------------------------------------------
-- `account_id` is NOT NULL: an order that belongs to nobody cannot provision an
-- identity, which is the entire purpose of an order. Signing up is free and
-- instant, so requiring it costs the funnel almost nothing and makes every order
-- attributable (D-019).
create sequence if not exists public.orders_number_seq start 1;

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  -- Human-quotable on a phone call: TT001, TT002...
  number        text not null unique
                default 'TT' || lpad(nextval('public.orders_number_seq')::text, 3, '0'),
  account_id    uuid not null references public.accounts(id) on delete cascade,
  product_code  text not null references public.products(code),
  quantity      int  not null check (quantity > 0),
  -- What was actually charged, in whole shillings. Never recomputed from the
  -- catalogue: a price change must not rewrite an existing order.
  amount_kes    int  not null check (amount_kes >= 0),
  status        text not null default 'new'
                check (status in (
                  'new', 'content_received', 'design', 'awaiting_approval',
                  'approved', 'in_production', 'qc', 'ready_for_dispatch',
                  'dispatched', 'delivered', 'revision_requested', 'cancelled'
                )),
  contact_name  text,
  contact_phone text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists orders_account_idx on public.orders(account_id, created_at desc);
create index if not exists orders_status_idx  on public.orders(status, created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

-- Customers read their own orders. They never write one directly: an order is
-- created server-side alongside the M-Pesa checkout it belongs to, so a client
-- cannot invent an order with an amount of its choosing.
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select using (
    account_id in (select account_id from public.profiles where id = auth.uid())
    or public.is_staff()
  );

drop policy if exists orders_update_staff on public.orders;
create policy orders_update_staff on public.orders
  for update using (public.is_staff()) with check (public.is_staff());

-- Column grants, following the pattern 0012 established for leads: a policy
-- governs which ROWS, never which COLUMNS. Staff advance fulfilment and annotate;
-- they can never edit the money or whose order it is.
revoke update on public.orders from authenticated;
grant update (status, contact_name, contact_phone, notes, updated_at)
  on public.orders to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Order events — append-only audit
-- ---------------------------------------------------------------------------
-- "Audit every transition" is only true if a transition cannot happen without
-- one. Application code writing its own audit row is a convention; a trigger is
-- a guarantee, and it survives a future path that forgets.
create table if not exists public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid references auth.users(id) on delete set null,
  note        text,
  at          timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id, at);

alter table public.order_events enable row level security;

-- Readable by the order's owner and by staff. No insert/update/delete policy at
-- all: rows arrive only from the trigger below, which is what makes this a
-- record rather than an assertion.
drop policy if exists order_events_select_own on public.order_events;
create policy order_events_select_own on public.order_events
  for select using (
    order_id in (
      select o.id from public.orders o
      where o.account_id in (select account_id from public.profiles where id = auth.uid())
    )
    or public.is_staff()
  );

create or replace function public.log_order_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_transition_ins on public.orders;
create trigger orders_log_transition_ins
  after insert on public.orders
  for each row execute function public.log_order_transition();

drop trigger if exists orders_log_transition_upd on public.orders;
create trigger orders_log_transition_upd
  after update on public.orders
  for each row execute function public.log_order_transition();

-- ---------------------------------------------------------------------------
-- 5) Payments belong to orders
-- ---------------------------------------------------------------------------
-- Nullable: renewal payments have no order, and every Sprint 4 and 6a row
-- predates this column.
alter table public.payments
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create index if not exists payments_order_idx on public.payments(order_id)
  where order_id is not null;

-- ---------------------------------------------------------------------------
-- 6) Provisioning identities when an order is paid
-- ---------------------------------------------------------------------------
-- Runs inside the M-Pesa callback. It is a function rather than application code
-- for one reason: taking a token from the unassigned pool has to be atomic, or
-- two concurrent callbacks hand the same physical card to two customers.
--
-- `for update skip locked` is what makes that safe — a second caller skips the
-- rows the first has claimed rather than blocking on or duplicating them.
--
-- Tokens come from the pre-minted pool first, so staff know which physical card
-- to encode. If the pool is short the remainder are minted here: running out of
-- blanks must never fail a payment that has already been taken.
create or replace function public.provision_identities(
  p_account_id uuid,
  p_kind       text,
  p_count      int,
  p_months     int default 12
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids      uuid[] := '{}';
  v_id       uuid;
  v_taken    int := 0;
  v_now      timestamptz := now();
  v_term_end timestamptz := now() + make_interval(months => p_months);
begin
  if p_count is null or p_count < 1 then
    return v_ids;
  end if;

  -- Claim from the pool.
  for v_id in
    select t.id
    from public.nfc_tags t
    where t.account_id is null
      and t.status = 'unassigned'
    order by t.created_at
    limit p_count
    for update skip locked
  loop
    update public.nfc_tags
      set account_id = p_account_id,
          kind       = p_kind,
          term_start = v_now,
          term_end   = v_term_end,
          claimed_at = coalesce(claimed_at, v_now)
      where id = v_id;
    v_ids  := array_append(v_ids, v_id);
    v_taken := v_taken + 1;
  end loop;

  -- Mint whatever the pool could not cover.
  while v_taken < p_count loop
    insert into public.nfc_tags (token, account_id, kind, status, term_start, term_end, claimed_at)
    values (
      replace(gen_random_uuid()::text, '-', ''),
      p_account_id,
      p_kind,
      'unassigned',
      v_now,
      v_term_end,
      v_now
    )
    returning id into v_id;
    v_ids  := array_append(v_ids, v_id);
    v_taken := v_taken + 1;
  end loop;

  return v_ids;
end;
$$;

revoke execute on function public.provision_identities(uuid, text, int, int) from public;
revoke execute on function public.provision_identities(uuid, text, int, int) from anon;
revoke execute on function public.provision_identities(uuid, text, int, int) from authenticated;
grant execute on function public.provision_identities(uuid, text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 7) Cancelling an order switches off what it provisioned
-- ---------------------------------------------------------------------------
-- D-019 starts an identity's twelve months at PAYMENT rather than at delivery,
-- which is simpler and is what the callback already does — but it creates a
-- hazard that delivery-start would not have: a cancelled or refunded order would
-- otherwise leave a live, working card behind, paid for by money that has been
-- given back.
--
-- A trigger rather than application code, so it holds whoever does the
-- cancelling and through whichever path.
create or replace function public.deactivate_cancelled_order_identities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.nfc_tags t
      set status = 'disabled',
          term_end = null
      where t.id in (
        select pt.tag_id
        from public.payment_tags pt
        join public.payments p on p.id = pt.payment_id
        where p.order_id = new.id
      );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_deactivate_on_cancel on public.orders;
create trigger orders_deactivate_on_cancel
  after update on public.orders
  for each row execute function public.deactivate_cancelled_order_identities();
