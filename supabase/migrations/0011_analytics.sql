-- Hornbill TapTap — Sprint UI-7: unified analytics
--
-- One RPC serving both the account report and the per-profile view: pass a page
-- id to scope it, or null for the whole account. Two near-identical functions
-- would drift, and the per-page view already lagged the dashboard by a sprint.
--
-- `get_page_analytics` (0003) is left in place — superseded, not dropped, so a
-- deploy in either order keeps working (§19.7).

create or replace function public.get_analytics(
  p_days    int  default 30,
  p_page_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with bounds as (
    select
      now() - make_interval(days => p_days)     as cur_from,
      now() - make_interval(days => p_days * 2) as prev_from
  ),
  my_pages as (
    select id, slug, title
    from public.smart_pages
    where account_id in (select account_id from public.profiles where id = auth.uid())
      -- null p_page_id = the whole account; otherwise a single page the caller owns.
      and (p_page_id is null or id = p_page_id)
  ),
  cur as (
    select e.*
    from public.events e, bounds b
    where e.smart_page_id in (select id from my_pages) and e.ts >= b.cur_from
  ),
  prev as (
    select e.*
    from public.events e, bounds b
    where e.smart_page_id in (select id from my_pages)
      and e.ts >= b.prev_from and e.ts < b.cur_from
  ),
  day_axis as (
    select generate_series(
      (now() - make_interval(days => p_days - 1))::date,
      now()::date,
      '1 day'::interval
    )::date as d
  )
  select jsonb_build_object(
    'days', p_days,
    'scope', case when p_page_id is null then 'account' else 'page' end,
    'pages', (select count(*)::int from my_pages),

    'totals', coalesce((
      select jsonb_object_agg(type, c)
      from (select type, count(*)::int c from cur group by type) t
    ), '{}'::jsonb),
    'previous', coalesce((
      select jsonb_object_agg(type, c)
      from (select type, count(*)::int c from prev group by type) t
    ), '{}'::jsonb),

    'leads', (
      select count(*)::int from public.leads, bounds b
      where smart_page_id in (select id from my_pages) and created_at >= b.cur_from
    ),
    'previous_leads', (
      select count(*)::int from public.leads, bounds b
      where smart_page_id in (select id from my_pages)
        and created_at >= b.prev_from and created_at < b.cur_from
    ),

    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', d, 'tap', tap, 'scan', scan, 'view', view,
          'click', click, 'download', download, 'lead', lead
        ) order by d
      )
      from (
        select
          a.d,
          count(e.id) filter (where e.type = 'tap')::int      as tap,
          count(e.id) filter (where e.type = 'scan')::int     as scan,
          count(e.id) filter (where e.type = 'view')::int     as view,
          count(e.id) filter (where e.type = 'click')::int    as click,
          count(e.id) filter (where e.type = 'download')::int as download,
          count(e.id) filter (where e.type = 'lead')::int     as lead
        from day_axis a
        left join cur e on e.ts::date = a.d
        group by a.d
      ) s
    ), '[]'::jsonb),

    -- How visitors arrived. Events predating migration 0010 have no captured
    -- source and are reported as 'unknown' rather than assigned one.
    'by_source', coalesce((
      select jsonb_agg(jsonb_build_object('source', src, 'count', c) order by c desc)
      from (
        select coalesce(source, 'unknown') src, count(*)::int c
        from cur group by 1
      ) s
    ), '[]'::jsonb),

    -- Per physical card. Only events carrying a tag_id can appear here.
    'by_device', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', id, 'label', label, 'token', token, 'count', c)
        order by c desc
      )
      from (
        select t.id, t.label, t.token, count(e.id)::int c
        from public.nfc_tags t
        join cur e on e.tag_id = t.id
        group by t.id, t.label, t.token
        order by c desc
        limit 10
      ) d
    ), '[]'::jsonb),

    'by_country', coalesce((
      select jsonb_agg(jsonb_build_object('country', country, 'count', c) order by c desc)
      from (
        select coalesce(country, 'unknown') country, count(*)::int c
        from cur group by 1 order by 2 desc limit 10
      ) g
    ), '[]'::jsonb),

    -- Hour of day in East Africa Time. Kenya is the launch market (§22) and no
    -- per-account timezone exists yet; UTC hours would be three hours off and
    -- actively misleading for "when do customers tap".
    'by_hour', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'count', c) order by h)
      from (
        select extract(hour from (e.ts at time zone 'Africa/Nairobi'))::int h,
               count(*)::int c
        from cur e group by 1
      ) hh
    ), '[]'::jsonb),

    -- Clicks per action. Counts clicks, never completions.
    'top_blocks', coalesce((
      select jsonb_agg(
        jsonb_build_object('label', label, 'type', type, 'count', c) order by c desc
      )
      from (
        select coalesce(l.label, l.type) label, l.type type, count(*)::int c
        from cur e
        join public.links l on l.id = e.link_id
        where e.type = 'click' and e.link_id is not null
        group by 1, 2 order by 3 desc limit 10
      ) tb
    ), '[]'::jsonb),

    'top_pages', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', id, 'slug', slug, 'title', title, 'events', c)
        order by c desc
      )
      from (
        select p.id, p.slug, p.title, count(e.id)::int c
        from my_pages p
        left join cur e on e.smart_page_id = p.id
        group by p.id, p.slug, p.title
        order by c desc limit 10
      ) tp
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_analytics(int, uuid) to authenticated;
