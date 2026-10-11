-- Hornbill TapTap — M3: leads can be paged through, however many there are
--
-- WHY: get_leads (0012) returns the newest N leads and stops. The web asks for
-- 200, so an account's 201st lead is unreachable in the inbox; the mobile app
-- needs to scroll through all of them, a page at a time, without the list
-- shifting as new leads arrive (docs/mobile/PLAN.md §2.2 #4, §10).
--
-- CHANGE: two optional arguments, a cursor — the created_at and id of the last
-- lead already shown. The next page is everything strictly older, in a stable
-- order (created_at, then id, both descending), so leads that share a
-- timestamp are neither repeated nor skipped.
--
-- The old signature is dropped and the new one created in the same transaction,
-- so PostgREST only ever sees one get_leads. Every existing call keeps working
-- unchanged: the web passes p_days, p_page_id, p_status and p_limit by name, and
-- the new arguments default to "first page".
--
-- The page size is capped at 5,000, not 200 as the plan first said: the CSV
-- export (app/api/leads/csv) asks for 5,000 in one call, and a lower cap would
-- quietly cut exports short.

drop function if exists public.get_leads(int, uuid, text, int);

create function public.get_leads(
  p_days              int         default 90,
  p_page_id           uuid        default null,
  p_status            text        default null,
  p_limit             int         default 200,
  p_before_created_at timestamptz default null,
  p_before_id         uuid        default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with my_pages as (
    select id, slug, title
    from public.smart_pages
    where account_id in (select account_id from public.profiles where id = auth.uid())
      and (p_page_id is null or id = p_page_id)
  ),
  scoped as (
    select l.*
    from public.leads l
    where l.smart_page_id in (select id from my_pages)
      and l.created_at >= now() - make_interval(days => p_days)
      and (p_status is null or l.status = p_status)
      -- Strictly after the cursor in (created_at desc, id desc) order.
      and (
        p_before_created_at is null
        or l.created_at < p_before_created_at
        or (l.created_at = p_before_created_at and p_before_id is not null and l.id < p_before_id)
      )
  ),
  -- Count sibling submissions across the whole account, not just the filtered
  -- set: "3 previous enquiries" must stay true when a status filter is applied.
  all_mine as (
    select l.id, l.phone, l.email
    from public.leads l
    where l.smart_page_id in (
      select id from public.smart_pages
      where account_id in (select account_id from public.profiles where id = auth.uid())
    )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'smart_page_id', s.smart_page_id,
        'page_title', p.title,
        'page_slug', p.slug,
        'name', s.name,
        'phone', s.phone,
        'email', s.email,
        'company', s.company,
        'message', s.message,
        'status', s.status,
        'note', s.note,
        'created_at', s.created_at,
        'updated_at', s.updated_at,
        'repeat_count', (
          select count(*)::int - 1
          from all_mine a
          where (a.phone is not null and a.phone = s.phone)
             or (a.email is not null and a.email = s.email)
        )
      )
      order by s.created_at desc, s.id desc
    ),
    '[]'::jsonb
  )
  from (
    select * from scoped
    order by created_at desc, id desc
    limit least(greatest(coalesce(p_limit, 200), 1), 5000)
  ) s
  join my_pages p on p.id = s.smart_page_id;
$$;

revoke execute on function public.get_leads(int, uuid, text, int, timestamptz, uuid) from public, anon;
grant execute on function public.get_leads(int, uuid, text, int, timestamptz, uuid) to authenticated;
