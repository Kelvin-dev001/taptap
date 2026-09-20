-- Hornbill TapTap — Sprint 8a: delivery priced at checkout (D-028)
--
-- WHY: Sprint 7 decided to ask for product, quantity and M-Pesa number and
-- nothing else, because "every field before a payment is a place to abandon it".
-- That was right when delivery was free and arranged afterwards over WhatsApp.
-- It stops being right the moment the amount depends on where the parcel is
-- going: a rider drop in Mombasa or Nairobi is free, anywhere else is a courier
-- or a shuttle parcel and costs money. We cannot push an STK amount before we
-- know which.
--
-- So one question moves in front of the payment — where is this going — and
-- everything else about delivery stays where Sprint 7 put it, editable
-- afterwards from the order page. That is one field, not a form.
--
-- THE RATE IS NOT IN lib/pricing.ts, and that is a deliberate exception to
-- D-018's "money has one source of truth". Courier rates move on somebody else's
-- schedule, and a price that needs a deploy to change is a price that stays
-- wrong for a week. It is still ONE copy of the number — the table is the source
-- of truth, lib/pricing.ts holds the arithmetic over it and no figure of its
-- own — and the fee is snapshotted onto the order when the order is created, so
-- changing a rate never rewrites what somebody was already charged.

-- ---------------------------------------------------------------------------
-- 1) The rates
-- ---------------------------------------------------------------------------
-- Zones rather than towns. A town list for Kenya is either wrong or enormous,
-- and the only distinction that costs us anything is "can a rider reach it
-- today". The customer's own town is recorded separately as free text, because
-- the rider still has to find the place.
create table if not exists public.delivery_rates (
  zone       text primary key,
  label      text not null,
  fee_kes    int  not null check (fee_kes >= 0),
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.delivery_rates (zone, label, fee_kes, sort_order)
values
  ('mombasa', 'Mombasa',      0,   1),
  ('nairobi', 'Nairobi',      0,   2),
  ('other',   'Another town', 300, 3)
on conflict (zone) do nothing;

alter table public.delivery_rates enable row level security;

-- Readable by anyone signed in: checkout has to show the fee before asking for
-- money, and a delivery charge is not a secret. Writable by nobody through the
-- API — staff change a rate through the console, which uses the service role.
drop policy if exists delivery_rates_select_authenticated on public.delivery_rates;
create policy delivery_rates_select_authenticated on public.delivery_rates
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2) What an order records about getting there
-- ---------------------------------------------------------------------------
-- `contact_name` and `contact_phone` already exist (0017) and have never been
-- written by anything — Sprint 7 deferred them and no later screen collected
-- them. They become the recipient, rather than adding a second pair of columns
-- that mean the same thing and disagree within a month.
--
-- `delivery_fee_kes` is the snapshot. `orders.amount_kes` stays what was
-- actually charged, in total, so a receipt can itemise without recomputing a
-- rate that may since have moved.
alter table public.orders
  add column if not exists delivery_zone      text,
  add column if not exists delivery_town      text,
  add column if not exists delivery_area      text,
  add column if not exists delivery_notes     text,
  add column if not exists delivery_fee_kes   int not null default 0,
  add column if not exists dispatch_method    text,
  add column if not exists dispatch_reference text,
  add column if not exists dispatched_at      timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_delivery_fee_check') then
    alter table public.orders
      add constraint orders_delivery_fee_check check (delivery_fee_kes >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_dispatch_method_check') then
    alter table public.orders
      add constraint orders_dispatch_method_check
      check (dispatch_method is null or dispatch_method in ('rider', 'courier', 'shuttle'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) The customer can correct the address until it ships
-- ---------------------------------------------------------------------------
-- `orders_update_staff` (0017) is staff-only on both halves, so a customer
-- cannot update their own order at all — the column grant that exists alongside
-- it has never had a policy to act through. Rather than loosen the policy, which
-- would expose `status` to the row's owner, delivery corrections go through a
-- function that can express the one rule a grant cannot: only until it ships.
--
-- The zone is deliberately NOT editable here. It set the price, the price was
-- charged, and letting someone move from Nairobi to upcountry after paying is a
-- refund conversation rather than a text field.
create or replace function public.update_order_delivery(
  p_order_id uuid,
  p_contact_name text,
  p_contact_phone text,
  p_delivery_town text,
  p_delivery_area text,
  p_delivery_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_order public.orders%rowtype;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  select * into v_order from public.orders
    where id = p_order_id and account_id = v_account
    for update;
  if v_order.id is null then raise exception 'order not found'; end if;

  if v_order.status in ('dispatched', 'delivered') then
    raise exception 'already_dispatched'
      using hint = 'This order has already gone out. Call us if the address is wrong.';
  end if;
  if v_order.status = 'cancelled' then raise exception 'order is cancelled'; end if;

  update public.orders
    set contact_name   = nullif(btrim(p_contact_name), ''),
        contact_phone  = nullif(btrim(p_contact_phone), ''),
        delivery_town  = nullif(btrim(p_delivery_town), ''),
        delivery_area  = nullif(btrim(p_delivery_area), ''),
        delivery_notes = nullif(btrim(p_delivery_notes), ''),
        updated_at     = now()
    where id = p_order_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.update_order_delivery(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_order_delivery(uuid, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Dispatch records how it went and who has it
-- ---------------------------------------------------------------------------
-- "Dispatched" on its own is not enough to answer the only question a customer
-- asks after it, which is "where is it". A rider's name and number, or a waybill,
-- is the difference between an answer and an apology.
--
-- Staff only, and it does not move the status: `lib/orders.ts` owns which moves
-- are legal and the server action performs them, so this records the facts and
-- leaves the transition where it is tested.
create or replace function public.record_dispatch(
  p_order_id uuid,
  p_method text,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if p_method not in ('rider', 'courier', 'shuttle') then
    raise exception 'unknown dispatch method';
  end if;

  update public.orders
    set dispatch_method    = p_method,
        dispatch_reference = nullif(btrim(p_reference), ''),
        dispatched_at      = coalesce(dispatched_at, now())
    where id = p_order_id;
  if not found then raise exception 'order not found'; end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.record_dispatch(uuid, text, text) from public, anon;
grant execute on function public.record_dispatch(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) The overview learns about cards and parcels
-- ---------------------------------------------------------------------------
-- Redefined here rather than in 0022 because it now reads the delivery columns,
-- which do not exist until this migration. `security_invoker = true` is carried
-- forward deliberately: without it the view would run with its owner's rights
-- and silently bypass the RLS underneath, which would show every customer's
-- orders to every signed-in user (D-020).
--
-- `units_total` and `units_bound` are here so the board can render the binding
-- gate without a query per order. The board reads every open order at once, and
-- a card list that fires one round trip per row is how an ops screen becomes too
-- slow to use on a phone in a workshop.
-- THE COLUMN ORDER ABOVE `units_total` IS LOAD-BEARING. `create or replace view`
-- may only APPEND columns: it cannot reorder, rename or drop them. So 0018's
-- list is reproduced verbatim, character for character, and everything new goes
-- on the end. Tidying the order here would fail at apply time with "cannot
-- change name of view column", which is exactly the kind of error that gets
-- discovered halfway through a production migration.
create or replace view public.orders_overview
with (security_invoker = true)
as
select
  o.id,
  o.number,
  o.account_id,
  a.name as business_name,
  o.product_code,
  p.name as product_name,
  p.kind as product_kind,
  o.quantity,
  o.amount_kes,
  o.status,
  o.contact_name,
  o.contact_phone,
  o.notes,
  o.created_at,
  o.updated_at,
  (
    select pay.status
    from public.payments pay
    where pay.order_id = o.id
    order by
      case pay.status when 'paid' then 0 when 'pending' then 1 else 2 end,
      pay.created_at desc
    limit 1
  ) as payment_status,
  (
    select count(*)
    from public.payment_tags pt
    join public.payments pay2 on pay2.id = pt.payment_id
    where pay2.order_id = o.id
  ) as identity_count,

  -- Appended by 0023.
  p.fulfilment_path,
  p.variant as product_variant,
  o.delivery_fee_kes,
  o.delivery_zone,
  o.delivery_town,
  o.delivery_area,
  o.delivery_notes,
  o.dispatch_method,
  o.dispatch_reference,
  o.dispatched_at,
  o.replaces_tag_id,
  -- So the board can render the binding gate without a query per order. It reads
  -- every open order at once, and one round trip per row is how an ops screen
  -- becomes too slow to use on a phone in a workshop.
  (select count(*)::int from public.order_units u where u.order_id = o.id) as units_total,
  (
    select count(*)::int from public.order_units u
    where u.order_id = o.id and u.tag_id is not null
  ) as units_bound,
  -- The earliest first tap across this order's cards. NULL until one is tapped;
  -- 8b uses it to close the order and the follow-up list reads it to find
  -- parcels that arrived and were never opened.
  (
    select min(t.first_tap_at)
    from public.order_units u
    join public.nfc_tags t on t.id = u.tag_id
    where u.order_id = o.id
  ) as first_tap_at
from public.orders o
join public.accounts a on a.id = o.account_id
join public.products p on p.code = o.product_code;

grant select on public.orders_overview to authenticated;
