-- Hornbill TapTap — Sprint 2: page mode, public read RPC, storage, download events

-- 1) Allow a 'download' event type (e.g. vCard saves)
alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('tap', 'scan', 'view', 'click', 'download'));

-- Recreate log_event with the widened type check
create or replace function public.log_event(
  p_page_id  uuid,
  p_type     text,
  p_link_id  uuid default null,
  p_device   text default null,
  p_os       text default null,
  p_country  text default null,
  p_region   text default null,
  p_referrer text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type not in ('tap', 'scan', 'view', 'click', 'download') then
    raise exception 'invalid event type: %', p_type;
  end if;

  insert into public.events (smart_page_id, type, link_id, device, os, country, region, referrer)
  values (p_page_id, p_type, p_link_id, p_device, p_os, p_country, p_region, p_referrer);
end;
$$;

grant execute on function public.log_event(uuid, text, uuid, text, text, text, text, text) to anon, authenticated;

-- 2) Public read for page mode: returns the page + its ordered links as one JSON object.
--    SECURITY DEFINER so anon never touches the tenant tables directly.
create or replace function public.get_public_page(p_slug text)
returns jsonb
language sql
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
    ), '[]'::jsonb)
  )
  from public.smart_pages sp
  where sp.slug = lower(p_slug)
    and sp.is_active = true
  limit 1;
$$;

grant execute on function public.get_public_page(text) to anon, authenticated;

-- 3) Storage bucket for page assets (logos/avatars). Public read; owners write
--    only within their own account's folder ("<account_id>/...").
insert into storage.buckets (id, name, public)
values ('page-assets', 'page-assets', true)
on conflict (id) do nothing;

drop policy if exists "page-assets public read" on storage.objects;
create policy "page-assets public read" on storage.objects
  for select using (bucket_id = 'page-assets');

drop policy if exists "page-assets owner insert" on storage.objects;
create policy "page-assets owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'page-assets'
    and (storage.foldername(name))[1] in (
      select account_id::text from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "page-assets owner update" on storage.objects;
create policy "page-assets owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'page-assets'
    and (storage.foldername(name))[1] in (
      select account_id::text from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "page-assets owner delete" on storage.objects;
create policy "page-assets owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'page-assets'
    and (storage.foldername(name))[1] in (
      select account_id::text from public.profiles where id = auth.uid()
    )
  );
