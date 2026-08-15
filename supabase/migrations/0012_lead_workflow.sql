-- Hornbill TapTap — Sprint UI-8: lead workflow (status, notes)
--
-- The lead inbox could be read and exported but not WORKED: no way to record
-- that someone was called back, and no way to tell a new enquiry from one
-- settled last week. For an SME the whole value of capturing a lead is the
-- follow-up, so a read-only list is where leads go to be forgotten.
--
-- DECISION (D-015): a lead remains a SUBMISSION, not a deduplicated person.
-- A contacts table would be the CRM shape, but duplicate submissions are rare
-- at this scale, and the UI can group repeat submitters by phone or email at
-- query time. Every field needed to promote submissions into contacts later is
-- already captured, so this stays reversible — and building the CRM shape now
-- would be exactly the premature expansion §19 and §30.19 warn against.

alter table public.leads
  add column if not exists status text not null default 'new'
    check (status in ('new', 'contacted', 'won', 'lost'));
alter table public.leads
  add column if not exists note text;
alter table public.leads
  add column if not exists updated_at timestamptz;

create index if not exists leads_status_idx
  on public.leads(smart_page_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Owners can now annotate leads — but only annotate
-- ---------------------------------------------------------------------------
-- `leads` had SELECT and DELETE policies and no UPDATE policy at all, so
-- setting a status was impossible. Adding one raises a question the accounts
-- table already forced (migration 0007): a policy governs WHICH ROWS may be
-- written, never WHICH COLUMNS.
--
-- That matters more here than it did there. The name, phone, email, company and
-- message are a RECORD OF WHAT A CUSTOMER SUBMITTED. If an owner can edit them,
-- the lead stops being evidence of what someone actually asked for — and under
-- Kenya's Data Protection Act the business is the data controller for exactly
-- that record. `status` and `note` are the owner's own annotations and are
-- rightly editable; the submission is not.
drop policy if exists leads_update_own on public.leads;
create policy leads_update_own on public.leads
  for update using (
    smart_page_id in (
      select sp.id from public.smart_pages sp
      where sp.account_id in (
        select account_id from public.profiles where id = auth.uid()
      )
    )
  ) with check (
    smart_page_id in (
      select sp.id from public.smart_pages sp
      where sp.account_id in (
        select account_id from public.profiles where id = auth.uid()
      )
    )
  );

revoke update on public.leads from authenticated;
grant update (status, note, updated_at) on public.leads to authenticated;

-- submit_lead is SECURITY DEFINER and inserts as the owner of the function, so
-- public submissions are unaffected by the grant change above.

-- ---------------------------------------------------------------------------
-- Lead list with repeat-submitter context
-- ---------------------------------------------------------------------------
-- Returns the account's leads plus, for each, how many other submissions share
-- its phone or email. That is what makes a repeat enquiry visible without
-- introducing a separate contact entity (D-015).
create or replace function public.get_leads(
  p_days    int  default 90,
  p_page_id uuid default null,
  p_status  text default null,
  p_limit   int  default 200
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
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  from (select * from scoped order by created_at desc limit p_limit) s
  join my_pages p on p.id = s.smart_page_id;
$$;

grant execute on function public.get_leads(int, uuid, text, int) to authenticated;

-- Counts per status for the filter chips, over the same window.
create or replace function public.get_lead_counts(
  p_days    int  default 90,
  p_page_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with my_pages as (
    select id from public.smart_pages
    where account_id in (select account_id from public.profiles where id = auth.uid())
      and (p_page_id is null or id = p_page_id)
  ),
  scoped as (
    select l.status
    from public.leads l
    where l.smart_page_id in (select id from my_pages)
      and l.created_at >= now() - make_interval(days => p_days)
  )
  select jsonb_build_object(
    'all', (select count(*)::int from scoped),
    'by_status', coalesce(
      (select jsonb_object_agg(status, c)
       from (select status, count(*)::int c from scoped group by status) t),
      '{}'::jsonb
    )
  );
$$;

grant execute on function public.get_lead_counts(int, uuid) to authenticated;
