-- Hornbill TapTap — column-level grants on nfc_tags (D-025)
--
-- WHY: `nfc_tags` has carried a table-wide UPDATE policy for `authenticated`
-- since 0005 and has never been given column-level grants. Every other table a
-- signed-in user can write got that treatment as soon as it grew a write path —
-- `accounts` in 0007, `leads` in 0012, `orders` in 0017, `smart_pages` and
-- `quote_requests` in 0019. `nfc_tags` was missed, and it is the table that
-- decides what the product charges for.
--
-- An RLS policy controls WHICH ROWS a user may write, never WHICH COLUMNS. So
-- until this migration:
--
--   PATCH /rest/v1/nfc_tags?id=eq.<their own tag>   {"term_end": "2099-01-01"}
--
-- succeeds. `nfc_tags_update_own` checks only that the row stays on the caller's
-- account. And `account_live_identities` (0019) reads `status` and `term_end` —
-- both writable — so that single request defeats renewal enforcement (D-018),
-- the fourteen-day grace window, and the publish slot count (D-022) together.
--
-- This is the hole D-021 called "layer two is the one that was missing", one
-- table over, still open. It is fixed on its own rather than inside Sprint 8
-- because Sprint 8 adds `stock_state`, `serial`, `batch_id` and `variant` to
-- this same table, and every one of those would be customer-writable too.
--
-- NOTHING A CUSTOMER CAN DO TODAY STOPS WORKING. The two write paths the
-- narrowed grant would break move into SECURITY DEFINER functions in sections 2
-- and 3, which enforce the same rules the application code enforced in
-- TypeScript — now where they cannot be skipped.

-- ---------------------------------------------------------------------------
-- 1) The grant
-- ---------------------------------------------------------------------------
-- `label` is the only column a customer has any business writing directly: it
-- is a name they chose for a card, it is read by nobody but them, and no rule
-- anywhere depends on its value.
--
-- Verified against every writer in the app before narrowing:
--   renameTagAction       -> label                      (stays a direct write)
--   rebindTagAction       -> smart_page_id, status      (section 2)
--   setTagStatusAction    -> status                     (section 3)
--   claimTagAction        -> claim_tag RPC              (already definer, 0019)
--   replaceTagAction      -> replace_tag RPC            (already definer, 0010)
--   mintTagsAction        -> service role               (unaffected)
--   provisioning/callback -> service role               (unaffected)
--
-- INSERT and DELETE are revoked as well. `nfc_tags` has no INSERT or DELETE
-- policy, so RLS already refuses both; the revoke states the intent rather than
-- relying on a policy's absence, which is the kind of thing a later migration
-- adds back by accident.
revoke insert, update, delete on public.nfc_tags from authenticated;

grant update (label) on public.nfc_tags to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Repointing a card
-- ---------------------------------------------------------------------------
-- Was a direct PostgREST write in app/dashboard/devices/actions.ts, with the
-- published-page rule (D-021) checked in TypeScript immediately above it. That
-- check was correct and is reproduced here verbatim, for the reason 0019 gave
-- when it put the same rule inside claim_tag: a card pointing at a draft fails
-- in front of the cardholder's customer, and a rule enforced only in the caller
-- is a rule the next caller forgets.
--
-- Repointing without re-encoding is the core product promise (D-009), so this
-- stays cheap and conditional on nothing but ownership and publish state. In
-- particular it does NOT refuse a disabled tag: the Devices screen has always
-- offered Repoint on a switched-off card and re-enabled it as a side effect, and
-- a permissions fix is the wrong place to change what a button does.
create or replace function public.rebind_tag(p_tag_id uuid, p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_page_status text;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  perform 1 from public.nfc_tags
    where id = p_tag_id and account_id = v_account
    for update;
  if not found then raise exception 'card not found'; end if;

  select status into v_page_status
  from public.smart_pages
  where id = p_page_id and account_id = v_account;

  if v_page_status is null then raise exception 'page not found'; end if;
  if v_page_status <> 'published' then
    raise exception 'page_not_published'
      using hint = 'Publish this profile before pointing a card at it.';
  end if;

  update public.nfc_tags
    set smart_page_id = p_page_id,
        status        = 'assigned'
    where id = p_tag_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.rebind_tag(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Switching a card on and off
-- ---------------------------------------------------------------------------
-- Two values and no others. `disabled` is what a customer chooses when a card is
-- in a drawer and they do not want to be billed for it; `assigned` brings it
-- back. The third value `unassigned` is a minting state and is deliberately not
-- reachable from here — a customer cannot un-own their own card, because the
-- identity is the billing unit (D-018) and making one vanish on request is a
-- refund, not a toggle.
create or replace function public.set_tag_status(p_tag_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  if p_status not in ('assigned', 'disabled') then
    raise exception 'invalid status';
  end if;

  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  update public.nfc_tags
    set status = p_status
    where id = p_tag_id and account_id = v_account;
  if not found then raise exception 'card not found'; end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.set_tag_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) replace_tag carries the term
-- ---------------------------------------------------------------------------
-- The same billing hole, reached from the other side, so it closes here rather
-- than waiting for Sprint 8.
--
-- 0010's replace_tag copies `smart_page_id` onto the replacement card and
-- nothing else. It does not carry `term_start`, `term_end` or `kind`. A
-- replacement card therefore lands with term_end NULL — and identity_is_live()
-- (0015) treats NULL as live, unconditionally and forever, because failing open
-- on a missing timestamp was the right call for a backfill. The result is that
-- replacing a card converts a term that expires into one that never does.
--
-- Everything else about the function is unchanged, including which tags it
-- accepts. Sprint 8 tightens that separately (D-027): with stock cards printing
-- their own QR on the back, accepting any unowned token as a "replacement"
-- becomes a way to collect a free card, and that is a product decision rather
-- than a fix.
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
  if v_new.account_id is not null and v_new.account_id <> v_account then
    raise exception 'replacement card already belongs to another account';
  end if;

  update public.nfc_tags
    set status = 'disabled'
    where id = v_old.id;

  -- kind, term_start and term_end are the addition. The replacement continues
  -- the term the customer already paid for; it does not start a new one, and it
  -- does not inherit NULL.
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
