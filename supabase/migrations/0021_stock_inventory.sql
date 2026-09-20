-- Hornbill TapTap — Sprint 8a: stock inventory (D-026)
--
-- WHY: cards stop being made to order. A supplier prints them generically in
-- bulk, each carrying its own pre-minted token and a printed serial and QR, and
-- they sit on a shelf until a paid order is packed. Nothing in the schema knows
-- what a shelf is: `nfc_tags` has exactly two facts about a card, who owns it and
-- whether it is switched on, and neither can express "printed, chip written and
-- locked, sitting in a drawer in Mombasa".
--
-- This migration adds the inventory half. The provisioning half — placeholders,
-- binding a customer to a card, and locking down who may claim one — is 0022, so
-- that the shape of the stock model can be read and reviewed on its own.
--
-- THE AXIS RULE, which the rest of the sprint depends on: `status`
-- (unassigned / assigned / disabled) keeps exactly the meaning it has had since
-- 0005. It is about the IDENTITY: who owns this, is it switched on, what does it
-- point at. `stock_state` is about the PLASTIC: where is this object in the
-- world. They are different questions with different lifecycles, and collapsing
-- them would repeat the mistake D-019 avoided when it kept fulfilment and
-- payment apart. A card can be `in_stock` with no owner, and an identity can be
-- `assigned` with no plastic at all.

-- ---------------------------------------------------------------------------
-- 1) Batches
-- ---------------------------------------------------------------------------
-- A batch is a print run. It exists so that a defect traceable to one run can be
-- found without inspecting every card, and so the CSV the supplier prints from
-- has an obvious unit.
--
-- `quantity` is what we ORDERED. The number of tags actually minted against the
-- batch is a count, not a stored number, so the two can never disagree — if a
-- mint half-fails, the count tells the truth and `quantity` records the intent.
--
-- No upper bound in the database. The console caps a single mint at 1,000
-- because that is an operational judgement about how much plastic to commit to
-- at once, and operational judgements change more often than schemas.
create table if not exists public.card_batches (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  variant     text not null check (variant in ('standard', 'premium')),
  quantity    int  not null check (quantity > 0),
  supplier    text,
  notes       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  received_at timestamptz
);

create index if not exists card_batches_created_idx
  on public.card_batches(created_at desc);

alter table public.card_batches enable row level security;

-- Staff only, read and nothing else. Batches are created by the minting action
-- through the service role, behind the ADMIN_TOKEN second factor (D-020), for
-- the same reason minting has always worked that way: it creates permanent
-- public identifiers.
drop policy if exists card_batches_select_staff on public.card_batches;
create policy card_batches_select_staff on public.card_batches
  for select using (public.is_staff());

-- ---------------------------------------------------------------------------
-- 2) Serials
-- ---------------------------------------------------------------------------
-- The serial is what a person reads aloud over the phone and types into the
-- assign box when a camera will not focus. It is printed on the card next to the
-- QR.
--
-- It is deliberately NOT derivable from the token and the token is not derivable
-- from it. The token is the hardware identity (D-009) and is what resolves;
-- the serial is a label for humans. Anyone who can read a serial off a card in a
-- display case must learn nothing about where that card points.
--
-- One sequence across both variants rather than one each, so a serial is unique
-- on its own without the prefix having to be part of the key. The prefix says
-- which SKU a person is holding, which is the question staff actually ask when a
-- Premium blank and a Standard card look identical from the back.
create sequence if not exists public.card_serial_seq;

create or replace function public.next_card_serial(p_variant text)
returns text
language sql
volatile
set search_path = public
as $$
  select case p_variant when 'premium' then 'P-' else 'S-' end
      || lpad(nextval('public.card_serial_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------------
-- 3) What a tag now records about the plastic
-- ---------------------------------------------------------------------------
-- Every column is nullable or defaulted, so every row that exists today stays
-- valid and unchanged. A stand, a legacy card and a placeholder identity all
-- carry NULL for most of this, and that is the correct answer rather than a gap.
--
--   stock_state  at_supplier -> received -> in_stock -> allocated
--                defective from any state before allocated.
--                NULL for anything that is not stock plastic.
--   is_placeholder  an identity minted at payment whose token is never printed
--                   or encoded (0022). It exists so a customer can publish the
--                   moment they pay (D-022) while the card is still on a shelf.
--   variant      for a stock card, what it IS. For a placeholder, what it NEEDS,
--                so 0022's bind function can refuse a Standard card against a
--                Premium order without reading back through the order.
--   first_tap_at when this card was first tapped in the field. 8b uses it to
--                close the order; it is set once and never cleared.
--   superseded_by the card an identity moved ONTO, set on the row it moved off.
--                An audit trail for "where did this identity go", which
--                disabling alone cannot answer.
alter table public.nfc_tags
  add column if not exists batch_id       uuid references public.card_batches(id) on delete set null,
  add column if not exists serial         text,
  add column if not exists variant        text,
  add column if not exists stock_state    text,
  add column if not exists is_placeholder boolean not null default false,
  add column if not exists defect_reason  text,
  add column if not exists encoded_at     timestamptz,
  add column if not exists locked_at      timestamptz,
  add column if not exists encoded_by     uuid references auth.users(id) on delete set null,
  add column if not exists first_tap_at   timestamptz,
  add column if not exists superseded_by  uuid references public.nfc_tags(id) on delete set null;

-- Constraints added separately from the columns so that re-running this
-- migration cannot fail on a constraint that already exists.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nfc_tags_variant_check') then
    alter table public.nfc_tags
      add constraint nfc_tags_variant_check
      check (variant is null or variant in ('standard', 'premium'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'nfc_tags_stock_state_check') then
    alter table public.nfc_tags
      add constraint nfc_tags_stock_state_check
      check (stock_state is null or stock_state in
        ('at_supplier', 'received', 'in_stock', 'allocated', 'defective'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'nfc_tags_serial_key') then
    alter table public.nfc_tags add constraint nfc_tags_serial_key unique (serial);
  end if;
end $$;

-- Staff can read the shelf.
--
-- `nfc_tags_select_own` (0005) is scoped to the caller's account, which means a
-- stock card — owned by nobody — is invisible to everyone, staff included. The
-- console cannot show an inventory it cannot read.
--
-- Additive, and it weakens nothing: permissive policies OR together, so a
-- customer still sees exactly their own cards and no more. It is the same shape
-- as `orders_select_own` (0017), which has always been "mine, or I am staff".
-- Writing stays closed — 0020 narrowed the UPDATE grant to `label`, and every
-- stock mutation goes through a SECURITY DEFINER function.
drop policy if exists nfc_tags_select_staff on public.nfc_tags;
create policy nfc_tags_select_staff on public.nfc_tags
  for select using (public.is_staff());

create index if not exists nfc_tags_batch_idx on public.nfc_tags(batch_id);

-- The query the assign panel and the low-stock warning both run: what is on the
-- shelf, of this variant. Partial, because allocated and defective cards are the
-- overwhelming majority once this has been running a while and they are never
-- the answer.
create index if not exists nfc_tags_in_stock_idx
  on public.nfc_tags(variant, created_at)
  where stock_state = 'in_stock';

-- Assigning by typed serial, and by scanned QR after the token is parsed out.
create index if not exists nfc_tags_serial_idx
  on public.nfc_tags(serial)
  where serial is not null;

-- ---------------------------------------------------------------------------
-- 4) Adopting what was minted before any of this existed
-- ---------------------------------------------------------------------------
-- `/admin/mint` has been producing unowned tokens since Sprint 5, and some of
-- them are on physical cards that were encoded by hand. Those cards are real,
-- they work, and they must stay assignable — so they join a LEGACY batch as
-- ordinary in-stock Standard cards rather than being stranded outside the model.
--
-- They get serials so the console can show them like anything else, but they
-- carry NO printed serial and NO printed QR, because they were made before there
-- was anything to print. The only way to assign one is to tap it to a phone and
-- read the chip, which is exactly why 0022's assign flow keeps the NFC path even
-- though the camera is faster for everything else.
--
-- Scoped to unowned, non-disabled, unbatched rows. An owned tag is somebody's
-- card and is not stock; a disabled one was switched off deliberately and
-- putting it back on a shelf would resurrect a decision somebody made.
do $$
declare
  v_batch uuid;
  v_count int;
begin
  select count(*) into v_count
  from public.nfc_tags
  where account_id is null
    and status <> 'disabled'
    and batch_id is null
    and is_placeholder = false;

  if v_count > 0 then
    insert into public.card_batches (code, variant, quantity, supplier, notes)
    values (
      'LEGACY',
      'standard',
      v_count,
      'Pre-Sprint-8 minting',
      'Tokens minted through /admin/mint before stock existed. No printed serial '
        || 'or QR: assign these by tapping the chip, not by scanning.'
    )
    returning id into v_batch;

    update public.nfc_tags
      set batch_id    = v_batch,
          variant     = 'standard',
          stock_state = 'in_stock',
          serial      = public.next_card_serial('standard')
    where account_id is null
      and status <> 'disabled'
      and batch_id is null
      and is_placeholder = false;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Reading stock
-- ---------------------------------------------------------------------------
-- Counts by variant and state for the console, plus the low-stock signal. In SQL
-- rather than TypeScript because it counts a table that grows without limit,
-- which is the line 0018 drew for ops_overview and the same line applies here.
--
-- The threshold is a parameter rather than a constant: how few cards is "few"
-- depends on how fast they are selling, which is not a schema question.
create or replace function public.stock_overview(p_low_threshold int default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'byVariantState', coalesce((
      select jsonb_agg(jsonb_build_object(
        'variant', variant,
        'state',   stock_state,
        'count',   n
      ) order by variant, stock_state)
      from (
        select variant, stock_state, count(*)::int as n
        from public.nfc_tags
        where stock_state is not null
        group by variant, stock_state
      ) grouped
    ), '[]'::jsonb),
    'low', coalesce((
      select jsonb_agg(jsonb_build_object('variant', variant, 'inStock', n)
             order by variant)
      from (
        select variant, count(*)::int as n
        from public.nfc_tags
        where stock_state = 'in_stock'
        group by variant
        having count(*) < p_low_threshold
      ) scarce
    ), '[]'::jsonb),
    'placeholdersAwaitingCards', (
      select count(*)::int
      from public.nfc_tags
      where is_placeholder = true
        and status <> 'disabled'
    )
  );
$$;

revoke execute on function public.stock_overview(int) from public, anon;
grant execute on function public.stock_overview(int) to authenticated;
