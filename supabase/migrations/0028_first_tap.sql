-- Hornbill TapTap — the first tap closes the order (Sprint 8b, phase G)
--
-- WHY: 0021 gave every card a `first_tap_at` and 0023 surfaced it on
-- `orders_overview`, and nothing has ever written it. Meanwhile an order sits at
-- `dispatched` until a staff member remembers to mark it delivered, which means
-- "delivered" currently records somebody's memory rather than an event.
--
-- The first tap of an allocated card AFTER its order went out is the best
-- delivery confirmation we will ever get: the customer is holding the card and
-- it works. Nothing else in the system knows that for certain, and no courier
-- receipt proves the chip survived the journey.
--
-- TAPS BEFORE DISPATCH DO NOT COUNT. Staff test cards, and a test tap in the
-- workshop must never mark a parcel delivered that is still on the bench.

-- ---------------------------------------------------------------------------
-- 1) Record the first tap, and close the order if it was out for delivery
-- ---------------------------------------------------------------------------
-- One function, doing both, because they are one event and doing them in two
-- round trips from the tap path would mean a tap that half-counted.
--
-- SERVICE ROLE ONLY. This can move an order to `delivered`, so it must not be
-- reachable from a browser: the tap route calls it with the admin client from
-- inside `after()`, never from the page's own edge session. `log_event` is
-- granted to anon because logging a view is harmless; closing an order is not.
--
-- Idempotent by construction: the UPDATE carries `first_tap_at is null`, so the
-- second tap in the same second updates nothing and the caller is told there is
-- nothing to announce. That is what makes it safe to call on EVERY tap.
create or replace function public.record_first_tap(p_tag_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated  int;
  v_order    public.orders%rowtype;
  v_account  uuid;
begin
  -- Only an allocated card can have a first tap worth recording. A card still on
  -- the shelf being tapped is somebody testing it, and a placeholder has no
  -- plastic to tap at all.
  update public.nfc_tags
    set first_tap_at = now()
    where id = p_tag_id
      and first_tap_at is null
      and stock_state = 'allocated'
      and is_placeholder is not true;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    -- Already tapped, or not a card whose first tap means anything.
    return jsonb_build_object('first_tap', false);
  end if;

  select o.* into v_order
  from public.orders o
  join public.order_units u on u.order_id = o.id
  where u.tag_id = p_tag_id
  limit 1;

  if v_order.id is null then
    -- A card with no order behind it: a replacement bound by hand, or legacy.
    -- The tap is still recorded; there is simply no parcel to close.
    return jsonb_build_object('first_tap', true, 'order_closed', false);
  end if;

  v_account := v_order.account_id;

  -- Only from `dispatched`. An order already `delivered` needs nothing, and one
  -- that has not been dispatched is being tested in the workshop.
  if v_order.status = 'dispatched' then
    update public.orders set status = 'delivered' where id = v_order.id;

    -- The status trigger (0017) writes the order_events row and stamps
    -- `changed_by` from auth.uid(), which is NULL here. That is correct and
    -- deliberate: nobody moved this order, the customer's first tap did, and the
    -- audit trail should say so rather than name whichever staff member happened
    -- to be adjacent. The note makes it legible.
    update public.order_events
      set note = 'First tap'
      where id = (
        select max(id) from public.order_events
        where order_id = v_order.id and to_status = 'delivered'
      );

    return jsonb_build_object(
      'first_tap',    true,
      'order_closed', true,
      'order_id',     v_order.id,
      'account_id',   v_account
    );
  end if;

  return jsonb_build_object(
    'first_tap',    true,
    'order_closed', false,
    'order_id',     v_order.id,
    'account_id',   v_account
  );
end;
$$;

revoke execute on function public.record_first_tap(uuid) from public, anon, authenticated;
grant execute on function public.record_first_tap(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2) Who to tell, and what to say
-- ---------------------------------------------------------------------------
-- Same shape and the same reasoning as `dispatch_notification_target` (0026):
-- one SECURITY DEFINER read returning exactly the fields the composer needs,
-- rather than handing the notification layer a free hand over auth.users.
--
-- Returns the slug so the email can link to the profile's analytics, which is
-- the one thing an owner wants to look at the moment their card goes live.
create or replace function public.first_tap_notification_target(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'accountId',    o.account_id,
    'businessName', a.name,
    'orderNumber',  o.number,
    'quantity',     o.quantity,
    'productName',  p.name,
    'slug', (
      select sp.slug
      from public.order_units u
      join public.nfc_tags t on t.id = u.tag_id
      join public.smart_pages sp on sp.id = t.smart_page_id
      where u.order_id = o.id
      order by u.unit_index
      limit 1
    ),
    'ownerEmail', (
      select au.email
      from auth.users au
      join public.profiles pr on pr.id = au.id
      where pr.account_id = o.account_id
      order by pr.created_at
      limit 1
    )
  )
  from public.orders o
  join public.accounts a on a.id = o.account_id
  join public.products p on p.code = o.product_code
  where o.id = p_order_id;
$$;

revoke execute on function public.first_tap_notification_target(uuid) from public, anon, authenticated;
grant execute on function public.first_tap_notification_target(uuid) to service_role;
