-- Hornbill TapTap — M2: saving a draft keeps its actions, and no click is lost
--
-- WHY: every Save in the editor deleted all of a profile's `links` rows and
-- inserted new ones (savePageAction before M2). Two things broke each time:
--
--   1. `events.link_id` is ON DELETE SET NULL, so every past click came loose
--      from its action. "Top actions" and Insights quietly restarted from zero.
--
--   2. The live page is a snapshot (0009) that carries the OLD link ids, and logs
--      clicks with them. After a draft save those ids no longer existed, so
--      log_event's insert failed its foreign key — and /api/track ignores the
--      error. Clicks on the live page went unrecorded until the next publish.
--
-- The mobile app autosaves every few seconds, which would make both constant.
-- So (docs/mobile/PLAN.md §2.2 #1, §9 W4, §10):
--
--   A. save_page_draft() writes a whole draft in one transaction: the page, then
--      each action by its id (ids now come from the client), deleting only the
--      actions that were removed. The version check sits in the same statement
--      as the write, so a second device editing the same profile is told about
--      it instead of being overwritten.
--   B. `smart_pages.updated_at` now moves only when the DRAFT changes. Publishing,
--      unpublishing and switching a profile off no longer touch it, so they can
--      never look like a conflicting edit.
--   C. log_event keeps an event whose action no longer exists — or belongs to a
--      different page — by recording it without the action. Never lose a click.
--
-- Backward compatible: the old save path (delete + insert) still works against
-- this schema, and every log_event caller keeps its signature.

-- ---------------------------------------------------------------------------
-- B — updated_at is the draft's version
-- ---------------------------------------------------------------------------
-- set_updated_at() (0001) stays for any other table that uses it; smart_pages
-- gets its own trigger. A save that changes only the actions moves updated_at
-- itself (section A), because the page's own columns may not have changed.
create or replace function public.smart_pages_touch_draft()
returns trigger
language plpgsql
as $$
begin
  if (new.title, new.mode, new.redirect_url, new.config, new.theme)
     is distinct from (old.title, old.mode, old.redirect_url, old.config, old.theme) then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists smart_pages_set_updated_at on public.smart_pages;
drop trigger if exists smart_pages_touch_draft on public.smart_pages;
create trigger smart_pages_touch_draft
  before update on public.smart_pages
  for each row execute function public.smart_pages_touch_draft();

-- ---------------------------------------------------------------------------
-- A — one draft save, one transaction
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: it runs as the signed-in person, so RLS on
-- smart_pages and links and the column grants from 0019 apply exactly as they do
-- to a direct write. It grants nothing a client could not already do; what it
-- adds is atomicity and the version check. (The lead-form rule stays in the
-- server code that calls it: lib/page-draft.ts.)
--
-- p_blocks: a JSON array in display order of {id, type, label, value,
-- is_active}. NULL leaves the actions alone (a redirect page has none to edit).
--
-- Returns {ok: true, updated_at} or {ok: false, code: 'conflict', updated_at}
-- or {ok: false, code: 'not_found'}. Malformed input raises.
create or replace function public.save_page_draft(
  p_page_id             uuid,
  p_expected_updated_at timestamptz,
  p_title               text,
  p_mode                text,
  p_redirect_url        text,
  p_config              jsonb,
  p_theme               jsonb,
  p_blocks              jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated_at timestamptz;
  v_ids        uuid[];
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_expected_updated_at is null then
    raise exception 'expected_updated_at is required';
  end if;

  if p_blocks is not null then
    if jsonb_typeof(p_blocks) <> 'array' then
      raise exception 'invalid_blocks';
    end if;
    if jsonb_array_length(p_blocks) > 100 then
      raise exception 'too_many_blocks';
    end if;
    select coalesce(array_agg((e->>'id')::uuid), '{}')
      into v_ids
      from jsonb_array_elements(p_blocks) e;
    if array_position(v_ids, null) is not null then
      raise exception 'invalid_block_id';
    end if;
    if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then
      raise exception 'duplicate_block_id';
    end if;
  end if;

  -- The version check and the write are one statement, so two saves holding the
  -- same version cannot both pass it.
  update public.smart_pages
     set title        = p_title,
         mode         = p_mode,
         redirect_url = p_redirect_url,
         config       = coalesce(p_config, '{}'::jsonb),
         theme        = coalesce(p_theme, '{}'::jsonb),
         updated_at   = now()
   where id = p_page_id
     and updated_at = p_expected_updated_at
  returning updated_at into v_updated_at;

  if v_updated_at is null then
    -- RLS hides other accounts' pages, so "not found" also covers "not yours".
    select updated_at into v_updated_at from public.smart_pages where id = p_page_id;
    if v_updated_at is null then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
    return jsonb_build_object('ok', false, 'code', 'conflict', 'updated_at', v_updated_at);
  end if;

  if p_blocks is not null then
    delete from public.links
     where smart_page_id = p_page_id
       and not (id = any(v_ids));

    insert into public.links (id, smart_page_id, type, label, value, sort_order, is_active)
    select (e.item->>'id')::uuid,
           p_page_id,
           e.item->>'type',
           nullif(e.item->>'label', ''),
           nullif(e.item->>'value', ''),
           (e.ord - 1)::int,
           coalesce((e.item->>'is_active')::boolean, true)
      from jsonb_array_elements(p_blocks) with ordinality as e(item, ord)
    on conflict (id) do update
       set type       = excluded.type,
           label      = excluded.label,
           value      = excluded.value,
           sort_order = excluded.sort_order,
           is_active  = excluded.is_active
     where public.links.smart_page_id = p_page_id;

    -- An id that already belongs to another page — this account's (skipped by
    -- the WHERE above) or another account's (invisible under RLS, so skipped
    -- too) — would otherwise vanish from this save without a word. Refuse it,
    -- which rolls back everything above.
    if (
      select count(*) from public.links
      where smart_page_id = p_page_id and id = any(v_ids)
    ) <> cardinality(v_ids) then
      raise exception 'invalid_block_id';
    end if;
  end if;

  return jsonb_build_object('ok', true, 'updated_at', v_updated_at);
end;
$$;

revoke execute on function public.save_page_draft(uuid, timestamptz, text, text, text, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_page_draft(uuid, timestamptz, text, text, text, jsonb, jsonb, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- C — never lose a click
-- ---------------------------------------------------------------------------
-- Same signature and checks as 0010. The only change: a link id that is not one
-- of this page's actions is recorded as no link, rather than failing the insert
-- (a missing id) or crediting another page's action (a foreign one).
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
declare
  v_link_id uuid;
begin
  if p_type not in ('tap', 'scan', 'view', 'click', 'download', 'lead') then
    raise exception 'invalid event type: %', p_type;
  end if;
  if p_source is not null and p_source not in ('nfc', 'qr', 'direct', 'web') then
    raise exception 'invalid event source: %', p_source;
  end if;

  if p_link_id is not null then
    select id into v_link_id
      from public.links
     where id = p_link_id
       and smart_page_id = p_page_id;
  end if;

  insert into public.events (
    smart_page_id, type, link_id, device, os, country, region, referrer, source, tag_id
  )
  values (
    p_page_id, p_type, v_link_id, p_device, p_os, p_country, p_region, p_referrer,
    p_source, p_tag_id
  );
end;
$$;

grant execute on function public.log_event(
  uuid, text, uuid, text, text, text, text, text, text, uuid
) to anon, authenticated;

-- The 8-argument overload from 0002 is left as it is. Every caller passes
-- p_source (/api/track, the slug page, the tap route), which only the version
-- above has; a call without it matches both overloads and Postgres refuses it
-- as ambiguous. So nothing can reach the old one.
