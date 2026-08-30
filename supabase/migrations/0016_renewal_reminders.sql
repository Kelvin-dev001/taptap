-- Hornbill TapTap — renewal reminders (D-018 follow-through)
--
-- WHY: 0015 made an unrenewed device stop working, and the customer notice we
-- sent promised "we will remind you before the date". Nothing sent that
-- reminder. A product that silently switches off a card someone paid for, having
-- promised a warning, is worse than one that never promised.
--
-- Reuses the UI-13 notification machinery wholesale: same delivery log, same
-- claim-before-send idempotency, same honesty rule that 'sent' means the provider
-- accepted it and nothing more.

-- ---------------------------------------------------------------------------
-- 1) A dedupe key that can repeat across years
-- ---------------------------------------------------------------------------
-- `notification_deliveries_once unique (kind, ref_id, channel)` is exactly right
-- for leads: a lead is notified about once, ever. A device is notified about
-- every year, at each milestone — so keying on the tag id alone would send the
-- first year's reminders and then go permanently silent.
--
-- The key therefore includes the TERM the reminder is about:
--   renewal:<tag_id>:<term_end date>:<milestone>
-- Next year's term produces a different key and sends again. Re-running the cron
-- twice in one day produces the same key and cannot.
--
-- A separate nullable column with a partial unique index, rather than widening
-- the existing constraint: lead rows keep the constraint they already rely on.
alter table public.notification_deliveries
  add column if not exists dedupe_key text;

create unique index if not exists notification_deliveries_dedupe_key_idx
  on public.notification_deliveries(dedupe_key)
  where dedupe_key is not null;

-- The 0014 constraint has to become conditional, or it defeats the new key on
-- its own: `unique (kind, ref_id, channel)` across ALL rows means a given card
-- could hold exactly one 'renewal_T30' row ever, so year two would send nothing
-- no matter what dedupe_key said.
--
-- Replaced by the same rule applied only to rows that have no dedupe_key. Lead
-- notifications (dedupe_key NULL) keep precisely the protection they have today;
-- recurring notifications are governed by dedupe_key alone.
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_once;

create unique index if not exists notification_deliveries_once_idx
  on public.notification_deliveries(kind, ref_id, channel)
  where dedupe_key is null;

comment on column public.notification_deliveries.dedupe_key is
  'Idempotency key for notifications that RECUR (renewal reminders), including '
  'the term they concern so next year sends again. NULL for one-off '
  'notifications, which are deduplicated on (kind, ref_id, channel) instead.';

-- ---------------------------------------------------------------------------
-- 2) Everything needed to compose the reminders, in one call
-- ---------------------------------------------------------------------------
-- Returns accounts that hold at least one device inside the reminder horizon,
-- each with its devices and the owner's verified sign-up address.
--
-- The lower bound matters: without it every long-dead card would be re-examined
-- on every run forever. 60 days past expiry is generous enough that a cron
-- outage of any plausible length still delivers the "stopped working" notice.
--
-- SECURITY: returns owner email addresses keyed by nothing at all, so it must
-- never be reachable by anon or authenticated. PostgreSQL grants EXECUTE to
-- PUBLIC by default, so that default is revoked explicitly before granting to
-- service_role alone — same treatment as lead_notification_target in 0014.
create or replace function public.renewal_notification_targets(
  p_horizon_days int default 45,
  p_lookback_days int default 60
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'accountId',    a.id,
      'businessName', a.name,
      'ownerEmail', (
        select u.email
        from auth.users u
        join public.profiles pr on pr.id = u.id
        where pr.account_id = a.id
        order by pr.created_at
        limit 1
      ),
      'identities', jsonb_agg(
        jsonb_build_object(
          'id',      t.id,
          'label',   t.label,
          'kind',    t.kind,
          'termEnd', t.term_end
        )
        order by t.term_end
      )
    ) as row
    from public.accounts a
    join public.nfc_tags t on t.account_id = a.id
    where t.status <> 'disabled'
      and t.term_end is not null
      and t.term_end <= now() + make_interval(days => p_horizon_days)
      and t.term_end >= now() - make_interval(days => p_lookback_days)
    group by a.id, a.name
  ) s;
$$;

revoke execute on function public.renewal_notification_targets(int, int) from public;
revoke execute on function public.renewal_notification_targets(int, int) from anon;
revoke execute on function public.renewal_notification_targets(int, int) from authenticated;
grant execute on function public.renewal_notification_targets(int, int) to service_role;
