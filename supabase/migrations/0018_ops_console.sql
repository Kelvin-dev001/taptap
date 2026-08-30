-- Hornbill TapTap — Sprint 6c: operations console (D-020)
--
-- 6b made hardware buyable and left fulfilment to be advanced by hand in SQL.
-- This adds what staff need to run it: a joined view of orders, and the handful
-- of aggregates that genuinely need the database.
--
-- Deliberately small. Most of what the console shows comes straight from the
-- 0017 tables through existing RLS, and the fulfilment RULES live in
-- `lib/orders.ts` where they are tested — restating them in SQL would create two
-- copies that drift.

-- ---------------------------------------------------------------------------
-- 1) Orders with the facts every ops view needs beside them
-- ---------------------------------------------------------------------------
-- `security_invoker = true` is load-bearing. A Postgres view runs with its
-- OWNER's privileges by default, which would bypass the RLS on the tables
-- underneath and expose every customer's orders to every signed-in user. With
-- invoker rights the view inherits `orders_select_own` exactly: staff see all,
-- a customer sees their own.
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
  -- The most advanced payment wins. A retry after a failure means the order IS
  -- paid, and reporting the earlier failure would be a lie.
  (
    select pay.status
    from public.payments pay
    where pay.order_id = o.id
    order by
      case pay.status when 'paid' then 0 when 'pending' then 1 else 2 end,
      pay.created_at desc
    limit 1
  ) as payment_status,
  -- How many identities this order actually provisioned. Zero on a paid order
  -- means provisioning did not complete — the one failure the callback can
  -- leave behind, and the reason it is surfaced rather than assumed.
  (
    select count(*)
    from public.payment_tags pt
    join public.payments pay2 on pay2.id = pt.payment_id
    where pay2.order_id = o.id
  ) as identity_count
from public.orders o
join public.accounts a on a.id = o.account_id
join public.products p on p.code = o.product_code;

grant select on public.orders_overview to authenticated;

-- ---------------------------------------------------------------------------
-- 2) The aggregates that need the database
-- ---------------------------------------------------------------------------
-- Only what genuinely cannot be computed from a bounded query: counts over
-- tables that grow without limit, and the cross-account reconciliation list.
--
-- Stage counts and stuck/ageing flags are deliberately NOT here. Open orders are
-- few by definition — a fulfilment pipeline that holds thousands is a different
-- problem — so the console reads them and applies `isStuck()` from lib/orders.ts,
-- which is tested. A second copy of that rule in SQL would drift from the first.
create or replace function public.ops_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- SECURITY DEFINER reads across every account, so the gate is explicit rather
  -- than inherited. Raising beats returning empty: a silent empty dashboard
  -- looks like a quiet week rather than a permissions problem.
  if not public.is_staff() then
    raise exception 'not authorised';
  end if;

  select jsonb_build_object(
    'ordersTotal',   (select count(*) from public.orders),
    'ordersUnpaid',  (
      select count(*)
      from public.orders o
      where o.status <> 'cancelled'
        and not exists (
          select 1 from public.payments p
          where p.order_id = o.id and p.status = 'paid'
        )
    ),
    -- Paid, but nothing was provisioned. Should always be zero; if it is not,
    -- someone has paid for a card that does not exist.
    'ordersPaidUnprovisioned', (
      select count(*)
      from public.orders o
      where o.status <> 'cancelled'
        and exists (
          select 1 from public.payments p
          where p.order_id = o.id and p.status = 'paid'
        )
        and not exists (
          select 1
          from public.payment_tags pt
          join public.payments p2 on p2.id = pt.payment_id
          where p2.order_id = o.id
        )
    ),
    'identitiesActive', (
      select count(*)
      from public.nfc_tags t
      where t.account_id is not null
        and t.status <> 'disabled'
        and public.identity_is_live(t.term_end)
    ),
    'identitiesExpiring30', (
      select count(*)
      from public.nfc_tags t
      where t.account_id is not null
        and t.status <> 'disabled'
        and t.term_end is not null
        and t.term_end between now() and now() + interval '30 days'
    ),
    'identitiesLapsed', (
      select count(*)
      from public.nfc_tags t
      where t.account_id is not null
        and t.status <> 'disabled'
        and t.term_end is not null
        and not public.identity_is_live(t.term_end)
    ),
    'tagsUnclaimedPool', (
      select count(*) from public.nfc_tags t
      where t.account_id is null and t.status = 'unassigned'
    ),
    -- The reconciliation list D-018 deliberately left open: accounts carrying a
    -- legacy paid plan that hold no devices at all, so the per-identity
    -- migration gave them nothing. Each needs a decision, not a default.
    'paidWithoutIdentities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'accountId',  a.id,
        'name',       a.name,
        'planCode',   s.plan_code,
        'periodEnd',  s.current_period_end
      ) order by a.name)
      from public.accounts a
      join public.subscriptions s on s.account_id = a.id
      where coalesce(s.plan_code, 'free') <> 'free'
        and not exists (select 1 from public.nfc_tags t where t.account_id = a.id)
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.ops_overview() from public;
revoke execute on function public.ops_overview() from anon;
grant execute on function public.ops_overview() to authenticated;
