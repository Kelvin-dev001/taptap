-- Hornbill TapTap — Sprint UI-3: dashboard intelligence (audit items B8 + B9)
--
-- WHY: `get_account_overview` returns bare totals for a single window. A
-- dashboard that answers "what happened / what matters / what next"
-- (CLAUDE.md §14) needs three things it cannot provide:
--   1. a PRIOR PERIOD, so a change can be stated as fact rather than guessed,
--   2. a DAILY SERIES, so trend is visible rather than asserted,
--   3. WHICH profiles and actions drove the numbers.
-- Without #1 the product would either show no deltas or invent them; §30.7
-- forbids the latter, so the comparison window is a hard requirement, not a
-- nicety.
--
-- `get_account_overview` is left in place. It is superseded by
-- get_dashboard_overview but dropping it would break any caller mid-deploy.

-- ---------------------------------------------------------------------------
-- B8 — account overview with comparison window, daily series and breakdowns
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_overview(p_days int default 30)
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
  ),
  cur_events as (
    select e.*
    from public.events e, bounds b
    where e.smart_page_id in (select id from my_pages)
      and e.ts >= b.cur_from
  ),
  prev_events as (
    select e.*
    from public.events e, bounds b
    where e.smart_page_id in (select id from my_pages)
      and e.ts >= b.prev_from
      and e.ts <  b.cur_from
  ),
  -- Zero-filled day axis so a quiet day is a gap in the line, not a missing point.
  day_axis as (
    select generate_series(
      (now() - make_interval(days => p_days - 1))::date,
      now()::date,
      '1 day'::interval
    )::date as d
  )
  select jsonb_build_object(
    'days', p_days,
    'pages', (select count(*)::int from my_pages),

    'totals', coalesce((
      select jsonb_object_agg(type, c)
      from (select type, count(*)::int c from cur_events group by type) t
    ), '{}'::jsonb),

    -- Same-length window immediately before the current one. The caller decides
    -- what to do when a bucket here is 0 — see percentChange() in lib/metrics.ts.
    'previous', coalesce((
      select jsonb_object_agg(type, c)
      from (select type, count(*)::int c from prev_events group by type) t
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
          'date', d,
          'tap',   tap,
          'scan',  scan,
          'view',  view,
          'click', click
        ) order by d
      )
      from (
        select
          a.d,
          count(e.id) filter (where e.type = 'tap')::int   as tap,
          count(e.id) filter (where e.type = 'scan')::int  as scan,
          count(e.id) filter (where e.type = 'view')::int  as view,
          count(e.id) filter (where e.type = 'click')::int as click
        from day_axis a
        left join cur_events e on e.ts::date = a.d
        group by a.d
      ) s
    ), '[]'::jsonb),

    'top_pages', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', id, 'slug', slug, 'title', title, 'events', c)
        order by c desc
      )
      from (
        select p.id, p.slug, p.title, count(e.id)::int c
        from my_pages p
        left join cur_events e on e.smart_page_id = p.id
        group by p.id, p.slug, p.title
        order by c desc
        limit 5
      ) tp
    ), '[]'::jsonb),

    -- Clicks per action. Counts CLICKS, never completions — the platform cannot
    -- observe whether a review was left or a message was sent (CLAUDE.md §15).
    'top_blocks', coalesce((
      select jsonb_agg(
        jsonb_build_object('label', label, 'type', type, 'count', c)
        order by c desc
      )
      from (
        select coalesce(l.label, l.type) as label, l.type as type, count(*)::int c
        from cur_events e
        join public.links l on l.id = e.link_id
        where e.type = 'click' and e.link_id is not null
        group by 1, 2
        order by c desc
        limit 6
      ) tb
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_dashboard_overview(int) to authenticated;

-- ---------------------------------------------------------------------------
-- B9 — recent activity feed
-- ---------------------------------------------------------------------------
-- Deliberately limited to things a person DID: lead submissions, contact saves
-- and button clicks. Raw taps/scans/views are high volume and would bury them;
-- those live in the metrics instead.
create or replace function public.get_recent_activity(p_limit int default 12)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with my_pages as (
    select id, slug, title
    from public.smart_pages
    where account_id in (select account_id from public.profiles where id = auth.uid())
  ),
  items as (
    select
      'lead'::text                                   as kind,
      'lead'::text                                   as type,
      coalesce(l.name, l.phone, l.email, 'Someone')  as label,
      p.title                                        as page_title,
      p.slug                                         as page_slug,
      l.created_at                                   as ts
    from public.leads l
    join my_pages p on p.id = l.smart_page_id

    union all

    select
      'event'::text,
      e.type,
      coalesce(lk.label, lk.type, e.type),
      p.title,
      p.slug,
      e.ts
    from public.events e
    join my_pages p on p.id = e.smart_page_id
    left join public.links lk on lk.id = e.link_id
    where e.type in ('click', 'download')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', kind,
        'type', type,
        'label', label,
        'page_title', page_title,
        'page_slug', page_slug,
        'ts', ts
      ) order by ts desc
    ),
    '[]'::jsonb
  )
  from (select * from items order by ts desc limit p_limit) recent;
$$;

grant execute on function public.get_recent_activity(int) to authenticated;
