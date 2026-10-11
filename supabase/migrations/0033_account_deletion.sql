-- Hornbill TapTap — M4: an owner can delete their account (W7)
--
-- WHY: both app stores require in-app account deletion (Apple 5.1.1(v), Google
-- Play's account deletion policy), and nothing deleted an account before.
-- Deleting the `accounts` row is not an option: payments and orders are
-- ON DELETE CASCADE from it (0004, 0017), and those are tax records Kenya's Tax
-- Procedures Act expects kept for five years (docs/mobile/PLAN.md §2.2 #2).
--
-- DECIDED with Kelvin, 11 Oct 2026 (plan question 10):
--
--   * Other people share the business account → only this person is removed;
--     the business and everything in it stays.
--   * Last person on the account → profiles, their actions, analytics and leads
--     are deleted; insight dismissals, notification records and quote requests
--     too; every card is switched off, unlinked and unnamed; payment and order
--     records are KEPT with the personal details removed (names, phone numbers,
--     delivery details, order notes, the M-Pesa callback payload apart from
--     its receipt);
--     the account row stays as "Deleted account" so those records keep their
--     owner. Cards stay on the account, so they are never mistaken for unsold
--     stock.
--
-- The Supabase Auth user is deleted afterwards by the server route
-- (lib/account-deletion.ts), which also empties the account's photo folder in
-- Storage. This function only touches the database, in one transaction.
--
-- SERVICE ROLE ONLY: it takes a user id, so it must never be callable by a
-- signed-in person (who could pass someone else's). The route checks the
-- caller's own token, and a recent sign-in, before calling it.

-- ---------------------------------------------------------------------------
-- Audit: that a deletion happened, and how much it removed. No personal data.
-- ---------------------------------------------------------------------------
create table if not exists public.account_deletions (
  id             uuid primary key default gen_random_uuid(),
  -- No foreign key: the user is gone by the time anyone reads this.
  user_id        uuid not null,
  account_id     uuid,
  scope          text not null check (scope in ('member', 'account')),
  pages_deleted  int not null default 0,
  leads_deleted  int not null default 0,
  cards_disabled int not null default 0,
  payments_kept  int not null default 0,
  orders_kept    int not null default 0,
  deleted_at     timestamptz not null default now()
);

alter table public.account_deletions enable row level security;
-- No policies: readable and writable by the service role only.
revoke all on public.account_deletions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The deletion
-- ---------------------------------------------------------------------------
create or replace function public.delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account  uuid;
  v_members  int;
  v_pages    int;
  v_leads    int;
  v_cards    int;
  v_payments int;
  v_orders   int;
begin
  select account_id into v_account from public.profiles where id = p_user_id;
  if v_account is null then
    raise exception 'no_account';
  end if;
  -- Hornbill's own staff are removed by an admin, not from the app: losing the
  -- last staff login would lock everyone out of the ops console.
  if exists (select 1 from public.staff where user_id = p_user_id) then
    raise exception 'staff_account';
  end if;

  select count(*) into v_members from public.profiles where account_id = v_account;
  if v_members > 1 then
    insert into public.account_deletions (user_id, account_id, scope)
    values (p_user_id, null, 'member');
    return jsonb_build_object('scope', 'member');
  end if;

  select count(*) into v_pages from public.smart_pages where account_id = v_account;
  select count(*) into v_leads
    from public.leads
   where smart_page_id in (select id from public.smart_pages where account_id = v_account);
  select count(*) into v_payments from public.payments where account_id = v_account;
  select count(*) into v_orders from public.orders where account_id = v_account;

  -- Profiles take their actions, events and leads with them (ON DELETE
  -- CASCADE); cards and Premium proofs pointing at them are set to null.
  delete from public.smart_pages where account_id = v_account;
  delete from public.insight_dismissals where account_id = v_account;
  delete from public.notification_deliveries where account_id = v_account;
  delete from public.quote_requests where account_id = v_account;

  update public.nfc_tags
     set status = 'disabled', smart_page_id = null, label = null
   where account_id = v_account;
  get diagnostics v_cards = row_count;

  update public.orders
     set contact_name   = null,
         contact_phone  = null,
         notes          = null,
         delivery_area  = null,
         delivery_town  = null,
         delivery_notes = null
   where account_id = v_account;

  update public.order_units
     set proof_snapshot = null, proof_note = null
   where order_id in (select id from public.orders where account_id = v_account);

  -- Status history stays (when an order moved, and to what); the free-text
  -- notes staff add can name or phone the customer, so they go.
  update public.order_events
     set note = null
   where order_id in (select id from public.orders where account_id = v_account);

  -- The M-Pesa callback carries the payer's phone number. Keep what a tax
  -- record needs — amount, status, reference and date are their own columns —
  -- plus the M-Pesa receipt number, and drop the rest.
  update public.payments
     set raw = jsonb_strip_nulls(jsonb_build_object(
           'anonymised', true,
           'receipt', jsonb_path_query_first(
             coalesce(raw, '{}'::jsonb),
             '$.**.Item[*] ? (@.Name == "MpesaReceiptNumber").Value'
           )
         ))
   where account_id = v_account;

  update public.accounts
     set name = 'Deleted account', profile = '{}'::jsonb, notify = '{}'::jsonb
   where id = v_account;

  insert into public.account_deletions
    (user_id, account_id, scope, pages_deleted, leads_deleted, cards_disabled, payments_kept, orders_kept)
  values
    (p_user_id, v_account, 'account', v_pages, v_leads, v_cards, v_payments, v_orders);

  return jsonb_build_object(
    'scope', 'account',
    'account_id', v_account,
    'pages_deleted', v_pages,
    'leads_deleted', v_leads,
    'cards_disabled', v_cards
  );
end;
$$;

revoke execute on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
