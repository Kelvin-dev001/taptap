-- Hornbill TapTap — Sprint UI-6: event source + device attribution (B3, B4, B11)
--
-- WHY: today an NFC tap and someone typing the URL are recorded identically.
-- `/t/<token>` redirects to `/<slug>?src=nfc`, and the slug route logs a plain
-- `tap` — so "NFC taps vs QR scans" is guesswork, and there is no way at all to
-- ask which physical card produced a tap.
--
-- That second gap is the important one. Without `tag_id` the mockup's
-- "reception stand is underperforming" insight is not merely unbuilt, it is
-- unanswerable: nothing in the database connects an event to a card. A business
-- with a card at the till, one at reception and one on a table tent cannot be
-- told which is working.

-- ---------------------------------------------------------------------------
-- B3 — how the visitor arrived
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists source text
    check (source is null or source in ('nfc', 'qr', 'direct', 'web'));

-- Null means "recorded before this migration". Left deliberately unmigrated:
-- back-filling would mean inventing an origin for events whose origin was never
-- captured, which is exactly the fabrication §30.7 forbids. The UI reports
-- unknown-source events as unknown.

-- ---------------------------------------------------------------------------
-- B4 — which physical card produced the event
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists tag_id uuid references public.nfc_tags(id) on delete set null;

create index if not exists events_tag_idx on public.events(tag_id, ts desc)
  where tag_id is not null;

-- ---------------------------------------------------------------------------
-- log_event gains the two new fields
-- ---------------------------------------------------------------------------
-- Both are appended with defaults, so existing callers keep working unchanged
-- while the new ones pass attribution.
create or replace function public.log_event(
  p_page_id  uuid,
  p_type     text,
  p_link_id  uuid default null,
  p_device   text default null,
  p_os       text default null,
  p_country  text default null,
  p_region   text default null,
  p_referrer text default null,
  p_source   text default null,
  p_tag_id   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type not in ('tap', 'scan', 'view', 'click', 'download', 'lead') then
    raise exception 'invalid event type: %', p_type;
  end if;
  if p_source is not null and p_source not in ('nfc', 'qr', 'direct', 'web') then
    raise exception 'invalid event source: %', p_source;
  end if;

  insert into public.events (
    smart_page_id, type, link_id, device, os, country, region, referrer, source, tag_id
  )
  values (
    p_page_id, p_type, p_link_id, p_device, p_os, p_country, p_region, p_referrer,
    p_source, p_tag_id
  );
end;
$$;

grant execute on function public.log_event(
  uuid, text, uuid, text, text, text, text, text, text, uuid
) to anon, authenticated;

-- The 8-argument version stays callable so a deploy in either order works.
grant execute on function public.log_event(uuid, text, uuid, text, text, text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- resolve_tag now returns the ids the tap needs to be attributed
-- ---------------------------------------------------------------------------
-- The /t/<token> route is the only place that knows WHICH card was tapped, so
-- it has to log the event itself — but it needs the tag and page ids to do so.
-- Both are already implied by the token; returning them avoids a second query
-- on the latency-critical tap path.
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
      'tag_id', t.id,
      'page_id', (
        select sp.id from public.smart_pages sp
        where sp.id = t.smart_page_id
          and sp.is_active = true
          and sp.status = 'published'
      ),
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

-- ---------------------------------------------------------------------------
-- Device inventory with real numbers
-- ---------------------------------------------------------------------------
-- Powers the per-card performance view. Counts only events actually attributed
-- to a card, so a business can compare its till card against its reception card
-- rather than guessing.
create or replace function public.get_devices_overview(p_days int default 30)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with my_account as (
    select account_id from public.profiles where id = auth.uid()
  ),
  my_tags as (
    select t.*
    from public.nfc_tags t
    where t.account_id in (select account_id from my_account)
  ),
  tag_events as (
    select e.tag_id, count(*)::int c, max(e.ts) as last_ts
    from public.events e
    where e.tag_id in (select id from my_tags)
      and e.ts >= now() - make_interval(days => p_days)
    group by e.tag_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'token', t.token,
        'label', t.label,
        'status', t.status,
        'smart_page_id', t.smart_page_id,
        'page_title', sp.title,
        'page_slug', sp.slug,
        'claimed_at', t.claimed_at,
        'taps', coalesce(te.c, 0),
        'last_tap', te.last_ts
      )
      order by coalesce(te.c, 0) desc, t.created_at desc
    ),
    '[]'::jsonb
  )
  from my_tags t
  left join tag_events te on te.tag_id = t.id
  left join public.smart_pages sp on sp.id = t.smart_page_id;
$$;

grant execute on function public.get_devices_overview(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Replace a lost or damaged card
-- ---------------------------------------------------------------------------
-- Disables the old card and moves its binding to a new one in a single
-- transaction, so a lost card never keeps resolving after a replacement is
-- issued. Ownership of both is verified here rather than trusted.
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

  update public.nfc_tags
    set account_id    = v_account,
        smart_page_id = v_old.smart_page_id,
        label         = coalesce(v_new.label, v_old.label),
        status        = case when v_old.smart_page_id is null then 'unassigned' else 'assigned' end,
        claimed_at    = coalesce(v_new.claimed_at, now())
    where id = v_new.id;

  return jsonb_build_object('ok', true, 'new_tag_id', v_new.id);
end;
$$;

grant execute on function public.replace_tag(uuid, text) to authenticated;
