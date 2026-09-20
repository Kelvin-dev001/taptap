-- Hornbill TapTap — the "on its way" notification target (Sprint 8a follow-through)
--
-- WHY: 0023 gave dispatch a method and a reference, and Sprint 8a promised the
-- customer an email carrying them. The email needs one fact this codebase keeps
-- deliberately out of reach: the owner's address, which lives in `auth.users`
-- and is not readable from the application's session at all.
--
-- Same shape as `lead_notification_target` (0014) and
-- `renewal_notification_targets` (0016), and for the same reason: one
-- SECURITY DEFINER read that returns exactly the fields the composer needs,
-- rather than handing the notification layer the service role and a free hand
-- over auth.users.
--
-- It returns nothing until the order has actually been dispatched. A "your
-- parcel has left" email for a parcel still on the bench is worse than no email,
-- so the precondition is expressed here, where it cannot be forgotten by a
-- caller, instead of being trusted to the action that calls it.

create or replace function public.dispatch_notification_target(p_order_id uuid)
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
    'method',       o.dispatch_method,
    'reference',    o.dispatch_reference,
    -- What the customer told us, in the order a rider would read it. The zone is
    -- left out: "Mombasa" is already in the town for a Mombasa order, and
    -- "Upcountry" is a price band rather than a place anyone is going.
    'destination',  nullif(
      concat_ws(', ', nullif(btrim(o.delivery_area), ''), nullif(btrim(o.delivery_town), '')),
      ''
    ),
    'ownerEmail', (
      select u.email
      from auth.users u
      join public.profiles pr on pr.id = u.id
      where pr.account_id = o.account_id
      order by pr.created_at
      limit 1
    )
  )
  from public.orders o
  join public.accounts a on a.id = o.account_id
  join public.products p on p.code = o.product_code
  where o.id = p_order_id
    and o.dispatched_at is not null;
$$;

-- SECURITY: returns an owner's email address keyed only by an order id, so it
-- must never be reachable by anon or authenticated. PostgreSQL grants EXECUTE to
-- PUBLIC by default; that default is revoked explicitly before granting to
-- service_role alone.
revoke execute on function public.dispatch_notification_target(uuid) from public;
revoke execute on function public.dispatch_notification_target(uuid) from anon;
revoke execute on function public.dispatch_notification_target(uuid) from authenticated;
grant execute on function public.dispatch_notification_target(uuid) to service_role;
