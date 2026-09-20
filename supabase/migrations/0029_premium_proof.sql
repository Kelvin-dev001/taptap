-- Hornbill TapTap — the Premium proof (Sprint 8c, phase I)
--
-- WHY: 0022 defined the proof columns on `order_units` and left them for this
-- sprint, and Premium has been selling since 8a with staff producing the front
-- by hand. This is the flow that replaces the handwork: the customer chooses
-- which Tap Profile goes on the front of each card, sees it rendered on the
-- fixed CR80 template, and approves it or asks for changes.
--
-- EVERY FUNCTION HERE RUNS AS THE CUSTOMER, deliberately. The `order_events`
-- trigger (0017) stamps `changed_by` from `auth.uid()`, so an approval performed
-- by the service role would record the customer's decision as nobody's. The
-- approval is the one event in the whole fulfilment pipeline that is genuinely
-- theirs, and the audit trail has to say so.
--
-- SECURITY DEFINER with an explicit ownership check, exactly as
-- `update_order_delivery` (0023) does: `order_units` has no UPDATE policy a
-- customer could act through, and adding one would expose `tag_id` and the
-- binding columns to the row's owner. One function, one rule.

-- ---------------------------------------------------------------------------
-- 1) Which profile goes on this card
-- ---------------------------------------------------------------------------
-- Choosing a profile is also what makes the proof exist, so it moves the unit
-- to `awaiting_approval` in the same step. A separate "generate proof" action
-- would be a button whose only purpose is to make the next button appear.
create or replace function public.set_unit_proof_page(
  p_unit_id uuid,
  p_page_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_order   public.orders%rowtype;
  v_unit    public.order_units%rowtype;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  select u.* into v_unit from public.order_units u where u.id = p_unit_id for update;
  if v_unit.id is null then raise exception 'card not found'; end if;

  select o.* into v_order from public.orders o where o.id = v_unit.order_id;
  if v_order.account_id is distinct from v_account then raise exception 'card not found'; end if;

  -- Once approved the design is frozen (D-029). Changing the profile afterwards
  -- would change what gets printed without anyone approving the new version.
  if v_unit.proof_status = 'approved' then
    raise exception 'this card is already approved'
      using hint = 'Ask us to reopen it if the front needs to change.';
  end if;

  if v_order.status in ('dispatched', 'delivered', 'cancelled') then
    raise exception 'this order has already gone out';
  end if;

  -- The page must be one of theirs. Without this a customer could put somebody
  -- else's profile on their card by guessing an id.
  if not exists (
    select 1 from public.smart_pages
    where id = p_page_id and account_id = v_account
  ) then
    raise exception 'that profile does not belong to this account';
  end if;

  update public.order_units
    set proof_page_id = p_page_id,
        proof_status  = 'awaiting_approval',
        proof_note    = null
    where id = p_unit_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.set_unit_proof_page(uuid, uuid) from public, anon;
grant execute on function public.set_unit_proof_page(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Approve it, and freeze what was approved
-- ---------------------------------------------------------------------------
-- The snapshot is the point. A customer approves a specific card; if they then
-- rename their profile or swap the logo, the card already in production must
-- not silently change, and they must not discover the difference when it
-- arrives. The print output reads the snapshot, never the live profile.
--
-- The snapshot is composed by the application (lib/proof.ts) because the same
-- code has to drive the preview, the print page and the PNG. What this enforces
-- is that one is present and that the profile is published.
create or replace function public.approve_unit_proof(
  p_unit_id uuid,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account    uuid;
  v_order      public.orders%rowtype;
  v_unit       public.order_units%rowtype;
  v_published  boolean;
  v_outstanding int;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  select u.* into v_unit from public.order_units u where u.id = p_unit_id for update;
  if v_unit.id is null then raise exception 'card not found'; end if;

  select o.* into v_order from public.orders o where o.id = v_unit.order_id;
  if v_order.account_id is distinct from v_account then raise exception 'card not found'; end if;

  if v_unit.proof_status = 'approved' then
    return jsonb_build_object('ok', true, 'alreadyApproved', true);
  end if;
  if v_unit.proof_page_id is null then
    raise exception 'choose which profile goes on this card first';
  end if;
  if p_snapshot is null or p_snapshot = 'null'::jsonb then
    raise exception 'nothing to approve';
  end if;

  -- A card must work when it arrives. Printing somebody's name onto plastic
  -- that opens a draft nobody can see is a card dead on delivery (D-021).
  select (status = 'published') into v_published
  from public.smart_pages where id = v_unit.proof_page_id;

  if not coalesce(v_published, false) then
    raise exception 'publish this profile before approving it'
      using hint = 'A card that opens an unpublished page arrives dead.';
  end if;

  update public.order_units
    set proof_status   = 'approved',
        proof_snapshot = p_snapshot,
        proof_note     = null,
        approved_by    = auth.uid(),
        approved_at    = now()
    where id = p_unit_id;

  -- The ORDER moves only when every card on it is approved. A two-card order
  -- half-approved is still waiting on the customer.
  select count(*) into v_outstanding
  from public.order_units
  where order_id = v_order.id and coalesce(proof_status, 'approved') <> 'approved';

  if v_outstanding = 0 and v_order.status in ('awaiting_approval', 'revision_requested') then
    update public.orders set status = 'approved' where id = v_order.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'outstanding', v_outstanding,
    'orderApproved', v_outstanding = 0
  );
end;
$$;

revoke execute on function public.approve_unit_proof(uuid, jsonb) from public, anon;
grant execute on function public.approve_unit_proof(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Ask for changes
-- ---------------------------------------------------------------------------
-- The note is the whole value: "changes requested" with no reason is a message
-- that costs a phone call to act on.
create or replace function public.request_unit_revision(
  p_unit_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_order   public.orders%rowtype;
  v_unit    public.order_units%rowtype;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  select u.* into v_unit from public.order_units u where u.id = p_unit_id for update;
  if v_unit.id is null then raise exception 'card not found'; end if;

  select o.* into v_order from public.orders o where o.id = v_unit.order_id;
  if v_order.account_id is distinct from v_account then raise exception 'card not found'; end if;

  if v_order.status in ('in_production', 'qc', 'ready_for_dispatch', 'dispatched', 'delivered') then
    raise exception 'this card is already being made'
      using hint = 'Call us if it still needs to change.';
  end if;

  if nullif(btrim(p_note), '') is null then
    raise exception 'say what needs to change';
  end if;

  update public.order_units
    set proof_status = 'revision_requested',
        proof_note   = btrim(p_note),
        approved_by  = null,
        approved_at  = null
    where id = p_unit_id;

  if v_order.status = 'awaiting_approval' then
    update public.orders set status = 'revision_requested' where id = v_order.id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.request_unit_revision(uuid, text) from public, anon;
grant execute on function public.request_unit_revision(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Staff send a corrected proof back
-- ---------------------------------------------------------------------------
-- The other half of a revision: staff change what needs changing and put the
-- card back in front of the customer. Kept minimal on purpose — it returns the
-- unit to `awaiting_approval` and clears the approval, and does not touch the
-- profile, because the front is generated from the profile and editing somebody
-- else's profile is not something this console should do.
create or replace function public.resend_unit_proof(p_unit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit public.order_units%rowtype;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;

  select * into v_unit from public.order_units where id = p_unit_id for update;
  if v_unit.id is null then raise exception 'card not found'; end if;
  if v_unit.proof_page_id is null then
    raise exception 'the customer has not chosen a profile for this card yet';
  end if;

  update public.order_units
    set proof_status   = 'awaiting_approval',
        proof_snapshot = null,
        approved_by    = null,
        approved_at    = null
    where id = p_unit_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.resend_unit_proof(uuid) from public, anon;
grant execute on function public.resend_unit_proof(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) What the customer's order page needs to render a proof
-- ---------------------------------------------------------------------------
-- One read rather than a join the client assembles: the unit, its chosen page,
-- and whether that page is published — which is what decides whether the
-- Approve button is offered at all.
--
-- RLS does the scoping. `security_invoker` means this view inherits
-- `orders_select_own`, so a customer sees their own units and staff see all,
-- exactly as `orders_overview` does (D-020).
create or replace view public.order_unit_proofs
with (security_invoker = true)
as
select
  u.id,
  u.order_id,
  u.unit_index,
  u.proof_status,
  u.proof_page_id,
  u.proof_note,
  u.proof_snapshot,
  u.approved_at,
  o.account_id,
  o.number as order_number,
  o.status as order_status,
  p.slug   as page_slug,
  p.title  as page_title,
  p.status as page_status,
  p.config as page_config,
  p.theme  as page_theme
from public.order_units u
join public.orders o on o.id = u.order_id
left join public.smart_pages p on p.id = u.proof_page_id;

grant select on public.order_unit_proofs to authenticated;
