-- Hornbill TapTap — Sprint 8a: provisioning against stock (D-026, D-027)
--
-- WHY: 0017's provision_identities draws an arbitrary unowned token out of the
-- pool at the moment a payment clears. That was right when every card was made
-- to order and a "pool token" was just a number waiting to be encoded. With
-- printed stock on a shelf it is wrong in a way that costs money and trust: it
-- binds a specific physical card, sitting in a drawer in Mombasa, to customer A
-- — and then we post customer A a different card, which resolves to nothing.
--
-- The fix is to stop pretending we know which card someone will get. Payment
-- creates a PLACEHOLDER identity: a real, billable, publishable identity whose
-- token is never printed and never encoded. Scanning a card at fulfilment moves
-- that identity onto the plastic. The customer can publish the instant they pay
-- (D-022) and the shelf stays undisturbed until someone actually packs a parcel.
--
-- This migration also closes the claim hole. Every stock card prints its QR on
-- the back, so a photograph of a card in a display case is a token — and
-- claim_tag would have handed it over for nothing, permanently, because a tag
-- with no term_end is live forever (0015:128). See section 8.

-- ---------------------------------------------------------------------------
-- 1) Products know how they are fulfilled
-- ---------------------------------------------------------------------------
-- Three paths, because three genuinely different things happen in the workshop:
--
--   stock          pick a printed card off the shelf, scan it, pack it
--   custom         pick a Premium blank, print the customer's front, then pack
--   made_to_order  build the stand and encode its chip, as we always have
--
-- `provisions_identity` is false for replacement SKUs. The billing unit is the
-- identity, not the plastic (D-018) — a customer replacing a lost card is buying
-- a new piece of plastic for an identity they already own and already paid for.
-- Minting a second identity would charge them twice for one thing.
--
-- `variant` says which SKU of card a product needs off the shelf. NULL for
-- stands, which have no variant because they are not cards.
alter table public.products
  add column if not exists fulfilment_path     text not null default 'made_to_order',
  add column if not exists provisions_identity boolean not null default true,
  add column if not exists variant             text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_fulfilment_path_check') then
    alter table public.products
      add constraint products_fulfilment_path_check
      check (fulfilment_path in ('stock', 'custom', 'made_to_order'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'products_variant_check') then
    alter table public.products
      add constraint products_variant_check
      check (variant is null or variant in ('standard', 'premium'));
  end if;
end $$;

update public.products
  set fulfilment_path = 'stock', variant = 'standard'
  where code = 'smart_card';

update public.products
  set fulfilment_path = 'made_to_order', variant = null
  where code = 'smart_stand';

-- Premium is sold from day one. Until 8c automates the proof, staff produce the
-- front by hand and mark the unit approved in the console — 8c then automates a
-- process that is already running rather than inventing one.
insert into public.products (code, name, kind, bundled_months, sort_order, fulfilment_path, variant)
values
  ('smart_card_premium', 'Premium Card', 'card', 12, 2, 'custom', 'premium')
on conflict (code) do nothing;

update public.products set sort_order = 3 where code = 'smart_stand';

-- Replacements. No bundled months and no new identity: the term travels with
-- the identity, which is not being replaced — only the card it lives on.
insert into public.products
  (code, name, kind, bundled_months, sort_order, fulfilment_path, variant, provisions_identity)
values
  ('smart_card_replacement',         'Replacement Card',         'card', 0, 10, 'stock',  'standard', false),
  ('smart_card_premium_replacement', 'Replacement Premium Card', 'card', 0, 11, 'custom', 'premium',  false)
on conflict (code) do nothing;

-- Which card an order is replacing. NULL for everything that is not a
-- replacement, which is almost every order.
alter table public.orders
  add column if not exists replaces_tag_id uuid references public.nfc_tags(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2) One row per physical unit
-- ---------------------------------------------------------------------------
-- `orders.quantity` says how many things were bought. It cannot say which card
-- fulfilled which one, which is the question the workshop asks constantly:
-- "unit 1 of 2 is serial S-000123, what is unit 2". A quantity cannot hold a
-- proof either, and Premium needs one per card because two cards on one order
-- carry two different people's names.
--
-- `unit_index` rather than `index`: the latter is a keyword in enough dialects
-- that quoting it becomes a permanent tax on every query that touches this.
create table if not exists public.order_units (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  unit_index         int  not null check (unit_index > 0),

  -- The identity before it has plastic. NULL on a replacement, which moves an
  -- identity that already exists.
  placeholder_tag_id uuid references public.nfc_tags(id) on delete set null,
  -- The card being replaced. NULL on anything that is not a replacement.
  source_tag_id      uuid references public.nfc_tags(id) on delete set null,
  -- The physical card, once someone has scanned it.
  tag_id             uuid references public.nfc_tags(id) on delete set null,
  bound_at           timestamptz,
  bound_by           uuid references auth.users(id) on delete set null,

  -- Premium proof. Written in 8c; defined here so 8c needs no migration and so
  -- the shape of a unit can be reviewed once rather than twice.
  proof_page_id      uuid references public.smart_pages(id) on delete set null,
  proof_snapshot     jsonb,
  proof_status       text,
  proof_note         text,
  approved_by        uuid references auth.users(id) on delete set null,
  approved_at        timestamptz,

  created_at         timestamptz not null default now(),
  unique (order_id, unit_index)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_units_proof_status_check') then
    alter table public.order_units
      add constraint order_units_proof_status_check
      check (proof_status is null or proof_status in
        ('pending', 'awaiting_approval', 'approved', 'revision_requested'));
  end if;
end $$;

create index if not exists order_units_order_idx on public.order_units(order_id, unit_index);
create index if not exists order_units_tag_idx on public.order_units(tag_id);

alter table public.order_units enable row level security;

-- The owner sees their own units (the order page shows which serial is in the
-- parcel), staff see all. Nobody writes through the API: units are created by
-- provisioning and written by the bind function, both SECURITY DEFINER.
drop policy if exists order_units_select_own on public.order_units;
create policy order_units_select_own on public.order_units
  for select using (
    public.is_staff()
    or order_id in (
      select o.id from public.orders o
      where o.account_id in (select account_id from public.profiles where id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Payment provisions placeholders, not plastic
-- ---------------------------------------------------------------------------
-- Replaces provision_identities entirely. Three things moved INTO this function
-- that used to sit outside it in lib/provisioning.ts:
--
--   * creating the units
--   * inserting payment_tags
--   * the "have we already done this" check
--
-- All three now happen in the same transaction as the minting. Before, a crash
-- between provision_identities returning and the payment_tags insert landing
-- left identities with no payment link — which breaks renewals (extendPaidIdentities
-- reads payment_tags) and breaks the cancel trigger, silently, in a way nothing
-- would have noticed until a customer's card died a year later.
--
-- Idempotent on the order, not the payment: a replayed M-Pesa callback finds the
-- units already there and returns what exists. That is the guarantee the launch
-- checklist's replay test is checking for.
create or replace function public.provision_order(p_order_id uuid, p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.orders%rowtype;
  v_product public.products%rowtype;
  v_now     timestamptz := now();
  v_term    timestamptz;
  v_tag     uuid;
  v_units   int;
  i         int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'order not found'; end if;

  select * into v_product from public.products where code = v_order.product_code;
  if v_product.code is null then raise exception 'product not found'; end if;

  -- Already provisioned. Return rather than raise: a replayed callback is normal
  -- traffic, not an error, and Safaricom must get its 200 back.
  select count(*) into v_units from public.order_units where order_id = p_order_id;
  if v_units > 0 then
    return jsonb_build_object('ok', true, 'alreadyProvisioned', true, 'units', v_units);
  end if;

  v_term := v_now + make_interval(months => v_product.bundled_months);

  for i in 1 .. v_order.quantity loop
    v_tag := null;

    if v_product.provisions_identity then
      -- A placeholder for the stock paths; a real, encodable token for a stand.
      -- The difference is only `is_placeholder` and whether anyone ever prints
      -- the token: both are full identities and both count for the slot rule.
      insert into public.nfc_tags
        (token, account_id, kind, status, term_start, term_end, claimed_at,
         is_placeholder, variant)
      values (
        replace(gen_random_uuid()::text, '-', ''),
        v_order.account_id,
        v_product.kind,
        'unassigned',
        v_now,
        v_term,
        v_now,
        v_product.fulfilment_path <> 'made_to_order',
        v_product.variant
      )
      returning id into v_tag;

      -- Recorded at provisioning time, never recomputed, so a replayed renewal
      -- extends exactly the identities that were paid for (0015's reasoning,
      -- unchanged).
      insert into public.payment_tags (payment_id, tag_id)
      values (p_payment_id, v_tag)
      on conflict do nothing;
    end if;

    insert into public.order_units
      (order_id, unit_index, placeholder_tag_id, source_tag_id, tag_id, proof_status)
    values (
      p_order_id,
      i,
      -- A stand's token is the thing that gets encoded, so it is the unit's card
      -- from the start; there is no shelf to take it from.
      case when v_product.fulfilment_path = 'made_to_order' then null else v_tag end,
      case when v_product.provisions_identity then null else v_order.replaces_tag_id end,
      case when v_product.fulfilment_path = 'made_to_order' then v_tag else null end,
      case when v_product.fulfilment_path = 'custom' then 'pending' else null end
    );
  end loop;

  return jsonb_build_object('ok', true, 'alreadyProvisioned', false, 'units', v_order.quantity);
end;
$$;

revoke execute on function public.provision_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.provision_order(uuid, uuid) to service_role;

-- The pool draw is gone. Dropped rather than left unused: a function that still
-- exists is a function something can still call, and this one hands out physical
-- cards nobody has picked up.
drop function if exists public.provision_identities(uuid, text, int, int);

-- ---------------------------------------------------------------------------
-- 4) A placeholder token must never resolve
-- ---------------------------------------------------------------------------
-- Nothing prints it and nothing encodes it, so in practice nobody can tap one.
-- This is for the case where somebody reads one out of the database or guesses
-- thirty-two hex characters: a placeholder is an accounting row, not a card, and
-- it should behave like a token that does not exist.
create or replace function public.resolve_tag(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when t.id is null then null
    when t.status = 'disabled' then null
    when t.is_placeholder then null
    -- A card nobody has bought yet. Separated from `unassigned` because the two
    -- want opposite screens: an unactivated card gets a warm "this has not been
    -- set up yet" with a link to buy one, and must NOT offer a claim form,
    -- because claiming it is exactly what D-027 stops. `unassigned` now means
    -- "owned, not yet pointed at a page", which its owner can fix.
    when t.account_id is null then jsonb_build_object('status', 'unactivated', 'tag_id', t.id)
    when t.smart_page_id is null then
      jsonb_build_object('status', 'unassigned', 'tag_id', t.id, 'account_id', t.account_id)
    when not public.identity_is_live(t.term_end) then
      jsonb_build_object(
        'status',  'expired',
        'tag_id',  t.id,
        'page_id', p.id,
        'slug',    p.slug
      )
    else jsonb_build_object(
      'status',  'assigned',
      'tag_id',  t.id,
      'page_id', p.id,
      'slug',    p.slug
    )
  end
  from public.nfc_tags t
  left join public.smart_pages p
    on p.id = t.smart_page_id and p.status = 'published'
  where t.token = p_token;
$$;

grant execute on function public.resolve_tag(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Moving an identity onto a physical card
-- ---------------------------------------------------------------------------
-- The one function that joins a customer to plastic, used by new orders AND by
-- replacements, because they are the same operation: an identity that exists
-- moves onto a card that exists.
--
-- THE INVARIANT: the account's live-identity count is identical before and
-- after. That is what makes this safe to run against a customer who is already
-- published — a bind that quietly added a slot would let them publish a page
-- they have not paid for, and one that quietly removed a slot would darken a
-- page that is printed on somebody's shopfront. The count is checked rather than
-- asserted in a comment, because a comment cannot fail.
create or replace function public.bind_order_unit(p_unit_id uuid, p_card_tag_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit   public.order_units%rowtype;
  v_order  public.orders%rowtype;
  v_source public.nfc_tags%rowtype;
  v_card   public.nfc_tags%rowtype;
  v_paid   boolean;
  v_before int;
  v_after  int;
  v_page   uuid;
  v_pages  int;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;

  select * into v_unit from public.order_units where id = p_unit_id for update;
  if v_unit.id is null then raise exception 'unit not found'; end if;
  if v_unit.tag_id is not null then raise exception 'unit already has a card'; end if;

  select * into v_order from public.orders where id = v_unit.order_id for update;

  -- TT004: an order reached delivered with a failed payment because the board
  -- displayed a "Not paid" badge, and displaying is not enforcing. A bind spends
  -- a real card off the shelf, so it waits for the money.
  select exists (
    select 1 from public.payments
    where order_id = v_order.id and status = 'paid'
  ) into v_paid;
  if not v_paid then raise exception 'order is not paid'; end if;

  if v_order.status = 'cancelled' then raise exception 'order is cancelled'; end if;

  -- The identity being moved: a placeholder on a new order, the lost card on a
  -- replacement.
  select * into v_source from public.nfc_tags
    where id = coalesce(v_unit.placeholder_tag_id, v_unit.source_tag_id)
    for update;
  if v_source.id is null then raise exception 'this unit has no identity to move'; end if;

  select * into v_card from public.nfc_tags where id = p_card_tag_id for update;
  if v_card.id is null then raise exception 'card not found'; end if;
  if v_card.is_placeholder then raise exception 'that is a placeholder, not a card'; end if;
  if v_card.kind = 'stand' then raise exception 'that is a stand, not a card'; end if;
  if v_card.stock_state = 'defective' then raise exception 'that card is marked defective'; end if;
  if v_card.stock_state = 'allocated' then
    raise exception 'that card is already on order %',
      coalesce((
        select o.number from public.order_units u
        join public.orders o on o.id = u.order_id
        where u.tag_id = v_card.id limit 1
      ), 'another');
  end if;
  if v_card.stock_state is distinct from 'in_stock' then
    raise exception 'that card is not in stock (%)', coalesce(v_card.stock_state, 'no stock state');
  end if;
  if v_source.variant is not null and v_card.variant is distinct from v_source.variant then
    raise exception 'this order needs a % card, that one is %',
      v_source.variant, coalesce(v_card.variant, 'unmarked');
  end if;

  select public.account_live_identities(v_source.account_id) into v_before;

  -- If the identity has no page yet and the account has exactly one published
  -- page, point the card at it. Anything less obvious is left for the customer:
  -- guessing which of three profiles goes on a card is how a restaurant's card
  -- ends up opening the owner's personal profile.
  v_page := v_source.smart_page_id;
  if v_page is null then
    select count(*), min(id) into v_pages, v_page
    from public.smart_pages
    where account_id = v_source.account_id and status = 'published';
    if v_pages <> 1 then v_page := null; end if;
  end if;

  update public.nfc_tags
    set account_id    = v_source.account_id,
        kind          = v_source.kind,
        term_start    = v_source.term_start,
        term_end      = v_source.term_end,
        smart_page_id = v_page,
        label         = coalesce(v_card.label, v_source.label),
        claimed_at    = coalesce(v_card.claimed_at, v_source.claimed_at, now()),
        status        = case when v_page is null then 'unassigned' else 'assigned' end,
        stock_state   = 'allocated'
    where id = v_card.id;

  -- The source stops being anything. `superseded_by` is the audit trail: without
  -- it, a disabled placeholder is indistinguishable from a card someone switched
  -- off, and "where did this identity go" has no answer.
  update public.nfc_tags
    set status        = 'disabled',
        term_end      = null,
        superseded_by = v_card.id
    where id = v_source.id;

  -- Renewals and the cancel trigger both find their identities through
  -- payment_tags, so the link has to follow the identity onto the plastic or the
  -- customer renews a row that no longer means anything.
  update public.payment_tags set tag_id = v_card.id where tag_id = v_source.id;

  update public.order_units
    set tag_id   = v_card.id,
        bound_at = now(),
        bound_by = auth.uid()
    where id = v_unit.id;

  select public.account_live_identities(v_source.account_id) into v_after;
  if v_before is distinct from v_after then
    raise exception 'bind changed the live identity count (% -> %)', v_before, v_after;
  end if;

  return jsonb_build_object(
    'ok', true,
    'tagId', v_card.id,
    'serial', v_card.serial,
    'variant', v_card.variant,
    'boundToPage', v_page is not null
  );
end;
$$;

revoke execute on function public.bind_order_unit(uuid, uuid) from public, anon;
grant execute on function public.bind_order_unit(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Undo, until it is out of the door
-- ---------------------------------------------------------------------------
-- Staff scan the wrong card. It happens, and the recovery has to be one button
-- rather than a conversation, or the recovery is "post it anyway".
--
-- Refused once the order is dispatched, for the same reason cancelling is: the
-- card is in the post and the database cannot reach into a parcel.
create or replace function public.unbind_order_unit(p_unit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit   public.order_units%rowtype;
  v_order  public.orders%rowtype;
  v_source public.nfc_tags%rowtype;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;

  select * into v_unit from public.order_units where id = p_unit_id for update;
  if v_unit.id is null then raise exception 'unit not found'; end if;
  if v_unit.tag_id is null then raise exception 'nothing to undo'; end if;

  select * into v_order from public.orders where id = v_unit.order_id for update;
  if v_order.status in ('dispatched', 'delivered') then
    raise exception 'this order has already gone out';
  end if;

  select * into v_source from public.nfc_tags
    where id = coalesce(v_unit.placeholder_tag_id, v_unit.source_tag_id)
    for update;

  -- The identity goes back where it came from, term intact.
  update public.nfc_tags
    set status        = case when v_source.smart_page_id is null then 'unassigned' else 'assigned' end,
        term_end      = (select term_end from public.nfc_tags where id = v_unit.tag_id),
        superseded_by = null
    where id = v_source.id;

  update public.payment_tags set tag_id = v_source.id where tag_id = v_unit.tag_id;

  -- And the card goes back on the shelf, carrying nothing of the customer's.
  update public.nfc_tags
    set account_id    = null,
        smart_page_id = null,
        label         = null,
        term_start    = null,
        term_end      = null,
        claimed_at    = null,
        status        = 'unassigned',
        stock_state   = 'in_stock'
    where id = v_unit.tag_id;

  update public.order_units
    set tag_id = null, bound_at = null, bound_by = null
    where id = v_unit.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.unbind_order_unit(uuid) from public, anon;
grant execute on function public.unbind_order_unit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Cancelling returns the card to stock
-- ---------------------------------------------------------------------------
-- 0017's trigger disabled whatever the order provisioned, which was right when
-- "what it provisioned" was a token nobody had touched. Now it would burn a
-- printed, encoded, locked card — a real object worth real money — because
-- somebody cancelled an order before it shipped.
--
-- Still a trigger rather than application code, for D-019's reason: it holds
-- whoever cancels and through whichever path.
create or replace function public.deactivate_cancelled_order_identities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_units int;
begin
  if new.status <> 'cancelled' or old.status is distinct from 'cancelled' then
    return new;
  end if;

  select count(*) into v_units from public.order_units where order_id = new.id;

  if v_units = 0 then
    -- An order placed before this migration. Old behaviour, unchanged, because
    -- those orders have no units and their identities have no plastic.
    update public.nfc_tags t
      set status = 'disabled', term_end = null
      where t.id in (
        select pt.tag_id from public.payment_tags pt
        join public.payments p on p.id = pt.payment_id
        where p.order_id = new.id
      );
    return new;
  end if;

  -- Bound cards go back on the shelf with nothing of the customer's left on
  -- them. The identity does not need disabling separately: clearing the account
  -- is what ends it, and leaving a term behind on a card about to be sold to
  -- somebody else is how one customer inherits another's expiry date.
  update public.nfc_tags
    set account_id    = null,
        smart_page_id = null,
        label         = null,
        term_start    = null,
        term_end      = null,
        claimed_at    = null,
        status        = 'unassigned',
        stock_state   = 'in_stock'
    where id in (select tag_id from public.order_units where order_id = new.id and tag_id is not null)
      and is_placeholder = false;

  -- The payment covered an order that is being unwound, so it no longer covers
  -- anything. Left in place, a replayed renewal callback would extend the term
  -- of a card sitting in stock.
  delete from public.payment_tags
    where tag_id in (select tag_id from public.order_units where order_id = new.id and tag_id is not null);

  -- Placeholders that never reached a card, and stand tokens, are switched off
  -- exactly as before.
  update public.nfc_tags
    set status = 'disabled', term_end = null
    where id in (
      select placeholder_tag_id from public.order_units
      where order_id = new.id and placeholder_tag_id is not null
    );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) Nobody can claim a card they were not sold (D-027)
-- ---------------------------------------------------------------------------
-- Every stock card prints its own QR on the back. A photograph of one in a
-- display case, or of a stack on a counter, is a working token — and claim_tag
-- accepted any tag whose account_id was null. The claimant only needed a
-- published page, which any paying customer has. Because a claimed tag with no
-- term_end is live forever (0015:128), the free card would have stayed free.
--
-- So claim_tag stops being "claim a card" and becomes "link a card I already
-- own". Card-first sales — events, agents, resellers — need a customer to be
-- able to activate a card they were handed, and that needs an activation code
-- printed separately from the QR. Until that exists, nobody self-claims anything.
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
  if v_tag.is_placeholder then raise exception 'tag not found'; end if;

  -- The change. An unowned card is stock we have not sold yet, whoever is
  -- holding it and however they came to read its QR.
  if v_tag.account_id is null then
    raise exception 'tag_not_activated'
      using hint = 'This card has not been activated yet.';
  end if;
  if v_tag.account_id <> v_account then
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
    set smart_page_id = p_page_id,
        status = 'assigned',
        claimed_at = coalesce(claimed_at, now())
    where id = v_tag.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.claim_tag(text, uuid) to authenticated;

-- The same hole, reached through the replacement flow: "replace" a card you own
-- with any unowned token and the stock card becomes yours. A genuine lost-card
-- replacement is an order now (it involves posting an object), so the only thing
-- this needs to accept is a card the caller already owns.
create or replace function public.replace_tag(p_old_tag_id uuid, p_new_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_old public.nfc_tags%rowtype;
  v_new public.nfc_tags%rowtype;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  select * into v_old from public.nfc_tags
    where id = p_old_tag_id and account_id = v_account;
  if v_old.id is null then raise exception 'card not found'; end if;

  select * into v_new from public.nfc_tags where token = p_new_token for update;
  if v_new.id is null then raise exception 'replacement card not found'; end if;
  if v_new.status = 'disabled' then raise exception 'replacement card is disabled'; end if;
  if v_new.is_placeholder then raise exception 'replacement card not found'; end if;

  -- The change: `is distinct from` rather than 0010's "null or mine", so an
  -- unowned stock card is refused outright.
  if v_new.account_id is distinct from v_account then
    raise exception 'tag_not_activated'
      using hint = 'Order a replacement card. Cards cannot be swapped in by code.';
  end if;

  update public.nfc_tags
    set status = 'disabled'
    where id = v_old.id;

  update public.nfc_tags
    set account_id    = v_account,
        smart_page_id = v_old.smart_page_id,
        kind          = v_old.kind,
        term_start    = v_old.term_start,
        term_end      = v_old.term_end,
        label         = coalesce(v_new.label, v_old.label),
        status        = case when v_old.smart_page_id is null then 'unassigned' else 'assigned' end,
        claimed_at    = coalesce(v_new.claimed_at, now())
    where id = v_new.id;

  return jsonb_build_object('ok', true, 'new_tag_id', v_new.id);
end;
$$;

grant execute on function public.replace_tag(uuid, text) to authenticated;
