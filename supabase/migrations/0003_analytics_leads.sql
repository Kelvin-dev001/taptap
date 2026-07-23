-- Hornbill TapTap — Sprint 3: leads + analytics RPCs

-- 1) Widen event types to include 'lead' (funnel counting)
alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('tap', 'scan', 'view', 'click', 'download', 'lead'));

-- 2) Leads table (RLS on from the start; writes only via submit_lead RPC)
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  smart_page_id uuid not null references public.smart_pages(id) on delete cascade,
  name          text,
  phone         text,
  email         text,
  company       text,
  message       text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists leads_page_created_idx
  on public.leads(smart_page_id, created_at desc);

alter table public.leads enable row level security;

-- Owner can read/delete leads for pages in their account. No anon/auth INSERT policy —
-- inserts flow through submit_lead (SECURITY DEFINER) so the table is never exposed.
drop policy if exists leads_select_own on public.leads;
create policy leads_select_own on public.leads
  for select using (
    smart_page_id in (
      select sp.id from public.smart_pages sp
      where sp.account_id in (
        select account_id from public.profiles where id = auth.uid()
      )
    )
  );

drop policy if exists leads_delete_own on public.leads;
create policy leads_delete_own on public.leads
  for delete using (
    smart_page_id in (
      select sp.id from public.smart_pages sp
      where sp.account_id in (
        select account_id from public.profiles where id = auth.uid()
      )
    )
  );

-- 3) Public lead submission (anon), validated + rate-safe via the DB
create or replace function public.submit_lead(
  p_page_id uuid,
  p_name    text default null,
  p_phone   text default null,
  p_email   text default null,
  p_company text default null,
  p_message text default null,
  p_meta    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
begin
  select is_active into v_active from public.smart_pages where id = p_page_id;
  if v_active is not true then
    raise exception 'page not found or inactive';
  end if;

  if coalesce(p_name, '') = ''
     and coalesce(p_phone, '') = ''
     and coalesce(p_email, '') = '' then
    raise exception 'lead requires at least a name, phone, or email';
  end if;

  insert into public.leads (smart_page_id, name, phone, email, company, message, meta)
  values (
    p_page_id,
    nullif(p_name, ''),
    nullif(p_phone, ''),
    nullif(p_email, ''),
    nullif(p_company, ''),
    nullif(p_message, ''),
    coalesce(p_meta, '{}'::jsonb)
  );

  insert into public.events (smart_page_id, type) values (p_page_id, 'lead');
end;
$$;

grant execute on function public.submit_lead(uuid, text, text, text, text, text, jsonb)
  to anon, authenticated;

-- 4) Analytics — account overview (scoped to the caller's account via auth.uid())
create or replace function public.get_account_overview(p_days int default 30)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with my_pages as (
    select id from public.smart_pages
    where account_id in (select account_id from public.profiles where id = auth.uid())
  ),
  ev as (
    select type, count(*)::int c
    from public.events
    where smart_page_id in (select id from my_pages)
      and ts >= now() - make_interval(days => p_days)
    group by type
  )
  select jsonb_build_object(
    'days', p_days,
    'pages', (select count(*)::int from my_pages),
    'totals', coalesce((select jsonb_object_agg(type, c) from ev), '{}'::jsonb),
    'leads', (
      select count(*)::int from public.leads
      where smart_page_id in (select id from my_pages)
        and created_at >= now() - make_interval(days => p_days)
    )
  );
$$;

grant execute on function public.get_account_overview(int) to authenticated;

-- 5) Analytics — per-page detail (returns null if the page is not the caller's)
create or replace function public.get_page_analytics(p_page_id uuid, p_days int default 30)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with owned as (
    select sp.id from public.smart_pages sp
    where sp.id = p_page_id
      and sp.account_id in (select account_id from public.profiles where id = auth.uid())
  ),
  ev as (
    select * from public.events
    where smart_page_id in (select id from owned)
      and ts >= now() - make_interval(days => p_days)
  )
  select case when not exists (select 1 from owned) then null else jsonb_build_object(
    'days', p_days,
    'totals', coalesce(
      (select jsonb_object_agg(type, c)
       from (select type, count(*)::int c from ev group by type) t), '{}'::jsonb),
    'daily', coalesce(
      (select jsonb_agg(jsonb_build_object('date', d, 'count', c) order by d)
       from (select date_trunc('day', ts)::date d, count(*)::int c from ev group by 1) s),
      '[]'::jsonb),
    'devices', coalesce(
      (select jsonb_object_agg(coalesce(device, 'unknown'), c)
       from (select device, count(*)::int c from ev group by device) x), '{}'::jsonb),
    'os', coalesce(
      (select jsonb_object_agg(coalesce(os, 'unknown'), c)
       from (select os, count(*)::int c from ev group by os) y), '{}'::jsonb),
    'top_blocks', coalesce(
      (select jsonb_agg(jsonb_build_object('label', label, 'count', c) order by c desc)
       from (
         select coalesce(l.label, l.type, 'link') label, count(*)::int c
         from ev e
         join public.links l on l.id = e.link_id
         where e.type = 'click' and e.link_id is not null
         group by 1
         order by c desc
         limit 10
       ) z), '[]'::jsonb)
  ) end;
$$;

grant execute on function public.get_page_analytics(uuid, int) to authenticated;
