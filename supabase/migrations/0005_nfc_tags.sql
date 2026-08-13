-- Hornbill TapTap — Sprint 5: NFC tags (token-based identity, D-009)

-- Tags are minted BEFORE a buyer exists, so account_id is nullable until claimed.
create table if not exists public.nfc_tags (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  account_id    uuid references public.accounts(id) on delete set null,
  smart_page_id uuid references public.smart_pages(id) on delete set null,
  label         text,
  status        text not null default 'unassigned'
                check (status in ('unassigned', 'assigned', 'disabled')),
  claimed_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists nfc_tags_token_idx on public.nfc_tags(token);
create index if not exists nfc_tags_account_idx on public.nfc_tags(account_id);

alter table public.nfc_tags enable row level security;

-- Owners read + update their claimed tags (rebind/deactivate). Minting is server-only
-- (service role); resolve + claim go through SECURITY DEFINER RPCs.
drop policy if exists nfc_tags_select_own on public.nfc_tags;
create policy nfc_tags_select_own on public.nfc_tags
  for select using (
    account_id in (select account_id from public.profiles where id = auth.uid())
  );

drop policy if exists nfc_tags_update_own on public.nfc_tags;
create policy nfc_tags_update_own on public.nfc_tags
  for update using (
    account_id in (select account_id from public.profiles where id = auth.uid())
  ) with check (
    account_id in (select account_id from public.profiles where id = auth.uid())
  );

-- Resolve a tapped token: null (not found/disabled), unassigned, or assigned->slug.
create or replace function public.resolve_tag(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when t.id is null or t.status = 'disabled' then null
    when t.smart_page_id is null then jsonb_build_object('status', 'unassigned')
    else jsonb_build_object(
      'status', 'assigned',
      'slug', (
        select sp.slug from public.smart_pages sp
        where sp.id = t.smart_page_id and sp.is_active = true
      )
    )
  end
  from (
    select id, status, smart_page_id from public.nfc_tags where token = p_token
  ) t;
$$;
grant execute on function public.resolve_tag(text) to anon, authenticated;

-- Claim an unassigned tag and bind it to one of the caller's pages.
create or replace function public.claim_tag(p_token text, p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_tag public.nfc_tags%rowtype;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  select * into v_tag from public.nfc_tags where token = p_token for update;
  if v_tag.id is null then raise exception 'tag not found'; end if;
  if v_tag.status = 'disabled' then raise exception 'tag is disabled'; end if;
  if v_tag.account_id is not null and v_tag.account_id <> v_account then
    raise exception 'tag already claimed';
  end if;

  if not exists (
    select 1 from public.smart_pages where id = p_page_id and account_id = v_account
  ) then
    raise exception 'page not found';
  end if;

  update public.nfc_tags
    set account_id = v_account,
        smart_page_id = p_page_id,
        status = 'assigned',
        claimed_at = coalesce(claimed_at, now())
    where id = v_tag.id;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.claim_tag(text, uuid) to authenticated;
