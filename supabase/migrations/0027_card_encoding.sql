-- Hornbill TapTap — in-house chip encoding (Sprint 8b, phase H)
--
-- WHY: 0021 gave every card `encoded_at`, `locked_at` and `encoded_by`, and
-- nothing has ever written them. More seriously, nothing in the application can
-- move a card from `received` to `in_stock`: `receiveBatchAction` sets
-- `received`, and the only code that ever produced `in_stock` was the one-off
-- LEGACY adoption in 0021. A card minted through /admin/stock today can
-- therefore never become sellable. Encoding is the missing transition.
--
-- Chips arrive blank. Staff write one NDEF URL record, read it back, lock the
-- chip, and this function records that it happened. The write itself is Web NFC
-- in the browser; this is the half that has to be true afterwards.
--
-- WHY A FUNCTION rather than a service-role UPDATE from the server action, which
-- is what the rest of stock-actions.ts does: encoding is a state transition with
-- preconditions, exactly like `bind_order_unit`. A card that is already
-- allocated belongs to a customer, a placeholder has a token that is never
-- printed, and a stand is not stock. Checking that in TypeScript and writing
-- with the service role would put the rule somewhere the database does not
-- enforce it, and the service role bypasses every policy that would otherwise
-- catch the mistake.

-- ---------------------------------------------------------------------------
-- 1) Record that a chip was written, verified and (usually) locked
-- ---------------------------------------------------------------------------
-- `p_locked` is false only in the test mode of the encode page, which writes and
-- verifies without calling makeReadOnly() so a card can be re-used while staff
-- learn the flow. It is recorded honestly rather than assumed: an unlocked chip
-- is rewritable by anyone with a phone, and a shelf that cannot tell which is
-- which is worse than no record at all.
create or replace function public.encode_card(
  p_tag_id uuid,
  p_locked boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag public.nfc_tags%rowtype;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;

  -- FOR UPDATE because two staff encoding the same batch from two phones is the
  -- ordinary case, not the exotic one.
  select * into v_tag from public.nfc_tags where id = p_tag_id for update;
  if v_tag.id is null then raise exception 'card not found'; end if;

  if v_tag.is_placeholder then
    raise exception 'that is a placeholder identity, not a physical card'
      using hint = 'Placeholder tokens are never printed or encoded.';
  end if;

  if v_tag.kind = 'stand' then
    raise exception 'that is a stand, not a stock card'
      using hint = 'Encode a stand from its order, not from a batch.';
  end if;

  if v_tag.stock_state = 'defective' then
    raise exception 'that card is marked defective';
  end if;

  if v_tag.stock_state = 'allocated' then
    raise exception 'that card is already on an order'
      using hint = 'Re-encoding a card somebody has bought would break it.';
  end if;

  -- `received` is the only state a blank chip can legitimately be encoded from.
  -- `at_supplier` means it is not physically here yet, and encoding one would
  -- record a write that cannot have happened.
  if v_tag.stock_state is distinct from 'received' then
    raise exception 'card is % and can only be encoded when received', coalesce(v_tag.stock_state, 'unknown')
      using hint = 'Mark the batch received first.';
  end if;

  update public.nfc_tags
    set encoded_at  = now(),
        locked_at   = case when p_locked then now() else null end,
        encoded_by  = auth.uid(),
        stock_state = 'in_stock'
    where id = p_tag_id;

  return jsonb_build_object(
    'ok',     true,
    'serial', v_tag.serial,
    'locked', p_locked
  );
end;
$$;

revoke execute on function public.encode_card(uuid, boolean) from public, anon;
grant execute on function public.encode_card(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Encoding progress, per batch, in one round trip
-- ---------------------------------------------------------------------------
-- The page needs a count per state for every received batch. Doing that from the
-- application means reading every tag row and grouping in JavaScript — fine for
-- the eleven rows that exist today, and a thousand rows per batch the moment a
-- real order lands. PostgREST cannot GROUP BY, so the aggregate belongs here.
--
-- Staff-only, like the 0021 SELECT policy it depends on: these cards belong to
-- nobody, so an account-scoped read cannot see them at all.
create or replace function public.encode_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_staff() then coalesce(
    (
      select jsonb_agg(row_to_json(b) order by b.created_at desc)
      from (
        select
          cb.id,
          cb.code,
          cb.variant,
          cb.quantity,
          cb.created_at,
          count(*) filter (where t.stock_state = 'received')  ::int as remaining,
          count(*) filter (where t.stock_state = 'in_stock')  ::int as encoded,
          count(*) filter (where t.stock_state = 'defective') ::int as defective,
          count(*) filter (where t.locked_at is null and t.stock_state = 'in_stock')::int as unlocked
        from public.card_batches cb
        left join public.nfc_tags t on t.batch_id = cb.id
        where cb.received_at is not null
        group by cb.id, cb.code, cb.variant, cb.quantity, cb.created_at
      ) b
    ),
    '[]'::jsonb
  ) else null end;
$$;

revoke execute on function public.encode_overview() from public, anon;
grant execute on function public.encode_overview() to authenticated;
