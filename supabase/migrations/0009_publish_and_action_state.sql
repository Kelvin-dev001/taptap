-- Hornbill TapTap — Sprint UI-4: per-action state + publish lifecycle (B1 + B2)
--
-- Two gaps the builder cannot work around:
--
--   B1  `links` has no enabled flag, so an owner who wants to hide an action
--       must delete it and retype it later. The reference mockup's per-row
--       toggle has nothing to bind to.
--
--   B2  Every save is instantly public. UI-0 logged this as dangerous for a
--       real business: there is no way to prepare a page, and no way to take
--       one down without deleting it.
--
-- The publish model here is a SNAPSHOT, not a version history. `links`,
-- `config` and `theme` remain the editable draft; publishing copies the current
-- state into `smart_pages.published_content`, which is what the public path
-- serves. That gives a real draft/live split without building versioning, and
-- it makes the tap path cheaper — one row read instead of a join.

-- ---------------------------------------------------------------------------
-- B1 — per-action enabled state
-- ---------------------------------------------------------------------------
alter table public.links
  add column if not exists is_active boolean not null default true;

-- Default true means every existing action keeps behaving exactly as before.

-- ---------------------------------------------------------------------------
-- B2 — publish lifecycle
-- ---------------------------------------------------------------------------
alter table public.smart_pages
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published'));
alter table public.smart_pages
  add column if not exists published_at timestamptz;
alter table public.smart_pages
  add column if not exists published_content jsonb;

-- Existing pages are already live; record that rather than silently unpublishing
-- them. Defaulting `status` to 'published' also keeps newly created links
-- instantly live, which is the behaviour owners have today.
update public.smart_pages
  set published_at = coalesce(published_at, created_at)
  where status = 'published' and published_at is null;

-- ---------------------------------------------------------------------------
-- Snapshot builder — the single definition of "what the public sees"
-- ---------------------------------------------------------------------------
create or replace function public.build_page_snapshot(p_page_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', sp.id,
    'title', sp.title,
    'mode', sp.mode,
    'redirect_url', sp.redirect_url,
    'config', sp.config,
    'theme', sp.theme,
    'links', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'type', l.type,
          'label', l.label,
          'value', l.value,
          'sort_order', l.sort_order
        )
        order by l.sort_order, l.created_at
      )
      from public.links l
      where l.smart_page_id = sp.id
        and l.is_active = true      -- disabled actions never reach the public
    ), '[]'::jsonb)
  )
  from public.smart_pages sp
  where sp.id = p_page_id;
$$;

-- Publish: snapshot the current draft and mark the page live. Ownership is
-- checked here rather than trusted from the client.
create or replace function public.publish_page(p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  if not exists (
    select 1 from public.smart_pages
    where id = p_page_id and account_id = v_account
  ) then
    raise exception 'page not found';
  end if;

  update public.smart_pages
    set published_content = public.build_page_snapshot(p_page_id),
        status = 'published',
        published_at = now()
    where id = p_page_id;

  return jsonb_build_object('ok', true, 'published_at', now());
end;
$$;
grant execute on function public.publish_page(uuid) to authenticated;

-- Unpublish: take the page off the air without deleting anything. The snapshot
-- is kept so republishing restores exactly what was live before.
create or replace function public.unpublish_page(p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  select account_id into v_account from public.profiles where id = auth.uid();
  if v_account is null then raise exception 'not signed in'; end if;

  update public.smart_pages
    set status = 'draft'
    where id = p_page_id and account_id = v_account;

  if not found then raise exception 'page not found'; end if;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.unpublish_page(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public read paths now respect publish status
-- ---------------------------------------------------------------------------
-- Serves the snapshot when there is one. The fallback to a live build matters:
-- pages that existed before this migration have no snapshot yet, and without it
-- every one of them would go dark the moment this runs.
create or replace function public.get_public_page(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(sp.published_content, public.build_page_snapshot(sp.id))
  from public.smart_pages sp
  where sp.slug = lower(p_slug)
    and sp.is_active = true
    and sp.status = 'published'
  limit 1;
$$;
grant execute on function public.get_public_page(text) to anon, authenticated;

-- The redirect path gets the same treatment: an unpublished page must not
-- resolve, or "unpublish" would only half work.
create or replace function public.resolve_slug(p_slug text)
returns table (id uuid, mode text, redirect_url text)
language sql
security definer
set search_path = public
as $$
  select sp.id, sp.mode, sp.redirect_url
  from public.smart_pages sp
  where sp.slug = lower(p_slug)
    and sp.is_active = true
    and sp.status = 'published'
  limit 1;
$$;
grant execute on function public.resolve_slug(text) to anon, authenticated;

-- resolve_tag points at a page; an unpublished target should not resolve either.
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
        where sp.id = t.smart_page_id
          and sp.is_active = true
          and sp.status = 'published'
      )
    )
  end
  from (
    select id, status, smart_page_id from public.nfc_tags where token = p_token
  ) t;
$$;
grant execute on function public.resolve_tag(text) to anon, authenticated;

-- Backfill a snapshot for every page that is already live, so the fallback
-- above is a safety net rather than the normal path.
update public.smart_pages sp
  set published_content = public.build_page_snapshot(sp.id)
  where sp.status = 'published' and sp.published_content is null;
