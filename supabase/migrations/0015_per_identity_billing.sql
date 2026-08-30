-- Hornbill TapTap — Sprint 6a: per-identity billing (D-018)
--
-- WHY: billing has been per-account plan tiers since Sprint 4 — one subscription
-- row per account (`subscriptions.account_id` is UNIQUE), one plan code, one
-- period end, and profile-count gating via `maxProfiles`. The real commercial
-- model is per-identity: a customer buys a physical device whose price includes
-- twelve months of service, and renews each device annually.
--
-- The billing unit is the TAG, not the (tag, page) pair. `nfc_tags.smart_page_id`
-- is deliberately repointable (D-009) and repointing a card must never create or
-- destroy a billing unit — that promise was proven on real hardware in August.
--
-- This migration is additive and fails open. Nothing is deleted except one
-- verified-dead column, and any identity without a term keeps resolving.

-- ---------------------------------------------------------------------------
-- 1. Identities: a term and a device kind on every tag
-- ---------------------------------------------------------------------------

alter table public.nfc_tags
  add column if not exists kind text not null default 'card'
    check (kind in ('card', 'stand'));

alter table public.nfc_tags
  add column if not exists term_start timestamptz;

alter table public.nfc_tags
  add column if not exists term_end timestamptz;

comment on column public.nfc_tags.term_end is
  'End of this identity''s paid term. NULL = no term recorded; the identity '
  'stays live (fail open). Billing state is DERIVED from this column — `status` '
  'remains the lifecycle (unassigned/assigned/disabled) and the two are '
  'deliberately separate state machines.';

create index if not exists nfc_tags_term_end_idx
  on public.nfc_tags(term_end)
  where account_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Accounts: segment replaces the plan tier
-- ---------------------------------------------------------------------------

alter table public.accounts
  add column if not exists segment text not null default 'professional'
    check (segment in ('professional', 'business', 'commercial'));

comment on column public.accounts.segment is
  'Packaging, not a count-gate. Commercial is sales-led and only ever set '
  'deliberately by staff — it is never inferred from holdings.';

-- `accounts.plan` was written once at signup and read by nothing (verified by
-- grep across app/, lib/ and components/ before this migration). A dead column
-- carrying a money-shaped name is how the wrong number gets trusted later.
alter table public.accounts drop column if exists plan;

-- ---------------------------------------------------------------------------
-- 3. Payments: what a payment was FOR
-- ---------------------------------------------------------------------------
-- A renewal covering three identities is not a plan, so `plan_code` stops being
-- the key fact about a payment. It is kept, nullable, for the Sprint 4 rows.

alter table public.payments
  add column if not exists kind text
    check (kind is null or kind in ('hardware', 'renewal'));

alter table public.payments
  add column if not exists quantity int not null default 1
    check (quantity > 0);

alter table public.payments
  alter column plan_code drop not null;

comment on column public.payments.plan_code is
  'Legacy (Sprint 4 per-account plans). New rows set `kind` + `quantity` and '
  'link the identities they cover through payment_tags.';

-- ---------------------------------------------------------------------------
-- 4. Which identities a payment covers
-- ---------------------------------------------------------------------------
-- Required for correctness, not reporting: the M-Pesa callback is replay-safe
-- only if a repeated callback extends exactly the same set of identities as the
-- first one did. Recording the set at checkout time is what makes that true.

create table if not exists public.payment_tags (
  payment_id uuid not null references public.payments(id) on delete cascade,
  tag_id     uuid not null references public.nfc_tags(id) on delete cascade,
  primary key (payment_id, tag_id)
);

create index if not exists payment_tags_tag_idx on public.payment_tags(tag_id);

alter table public.payment_tags enable row level security;

-- Owners read the links for their own payments. No insert/update policy: writes
-- go through the service role, exactly as payments themselves do (0004).
drop policy if exists payment_tags_select_own on public.payment_tags;
create policy payment_tags_select_own on public.payment_tags
  for select using (
    payment_id in (
      select p.id from public.payments p
      where p.account_id in (
        select account_id from public.profiles where id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Entitlement helpers
-- ---------------------------------------------------------------------------

-- Days of grace past term_end during which a device keeps working. Mirrors
-- GRACE_DAYS in lib/pricing.ts; both are stated because both are enforced.
create or replace function public.billing_grace_days()
returns int
language sql
immutable
as $$ select 14; $$;

-- An identity is live while its term runs, plus grace. A NULL term is live:
-- failing open keeps a paying customer served rather than cutting them off over
-- a missing timestamp — the same choice subscriptionState() has always made.
create or replace function public.identity_is_live(p_term_end timestamptz)
returns boolean
language sql
immutable
as $$
  select p_term_end is null
      or now() < p_term_end + make_interval(days => public.billing_grace_days());
$$;

-- A page is live unless every identity pointing at it has lapsed.
--
-- A page with NO identities is live: building and publishing a profile is free,
-- and only a physical device is billable. A page whose cards have all lapsed
-- goes to the expired state so non-payment has a visible consequence.
create or replace function public.page_is_live(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.nfc_tags t
    where t.smart_page_id = p_page_id
      and t.account_id is not null
      and t.status <> 'disabled'
  )
  or exists (
    select 1 from public.nfc_tags t
    where t.smart_page_id = p_page_id
      and t.account_id is not null
      and t.status <> 'disabled'
      and public.identity_is_live(t.term_end)
  );
$$;

-- Whether an account may hide the "Powered by Hornbill TapTap" footer.
--
-- Audit finding: custom branding has been listed on the billing page since
-- Sprint 4 and enforced nowhere — the footer rendered unconditionally for every
-- account, paying or not. Selling a capability and not shipping it is worse than
-- not selling it, so the gate is made real here rather than carried forward.
--
-- Mirrors entitlementsFor() in lib/pricing.ts: the segment must include it AND
-- the account must still own a live device.
create or replace function public.account_has_custom_branding(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select a.segment in ('business', 'commercial')
     from public.accounts a where a.id = p_account),
    false
  )
  and exists (
    select 1 from public.nfc_tags t
    where t.account_id = p_account
      and t.status <> 'disabled'
      and public.identity_is_live(t.term_end)
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. Public read paths respect the term
-- ---------------------------------------------------------------------------

-- The page is still returned when expired, carrying `billing_state` so the
-- renderer can show a deliberate "this card is inactive" screen. Returning NULL
-- would produce a 404, which reads as *broken* to the cardholder's customer —
-- a person who never had the chance to pay.
create or replace function public.get_public_page(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(sp.published_content, public.build_page_snapshot(sp.id))
         || jsonb_build_object(
              'billing_state',
              case when public.page_is_live(sp.id) then 'live' else 'expired' end,
              'custom_branding',
              public.account_has_custom_branding(sp.account_id)
            )
  from public.smart_pages sp
  where sp.slug = lower(p_slug)
    and sp.is_active = true
    and sp.status = 'published'
  limit 1;
$$;
grant execute on function public.get_public_page(text) to anon, authenticated;

-- A lapsed card reports 'expired' rather than redirecting. The tap is still a
-- real interaction, so the route can still show the owner something useful.
create or replace function public.resolve_tag(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when t.id is null or t.status = 'disabled' then null
    when t.smart_page_id is null then jsonb_build_object('status', 'unassigned')
    -- page_id is still returned so the tap can be logged. A lapsed card that
    -- people keep tapping is a real interaction and the strongest possible
    -- argument for renewing it — dropping the event would hide that.
    when not public.identity_is_live(t.term_end) then jsonb_build_object(
      'status', 'expired',
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
    select id, status, smart_page_id, term_end
    from public.nfc_tags where token = p_token
  ) t;
$$;
grant execute on function public.resolve_tag(text) to anon, authenticated;

-- resolve_slug has no caller in the app today (the slug route reads the
-- snapshot through get_public_page), but it is granted to anon, so leaving it
-- ungated would make it a way to read a lapsed page's destination directly.
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
    and public.page_is_live(sp.id)
  limit 1;
$$;
grant execute on function public.resolve_slug(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Backfill — convert existing entitlements without restarting anyone's clock
-- ---------------------------------------------------------------------------
-- Deliberately generic: every account holding a non-free plan converts, with no
-- account ids hard-coded, because paid access has been granted by hand more than
-- once. Each claimed device inherits the account's existing period end, so a
-- customer gets exactly the time they were already promised.

update public.nfc_tags t
set term_start = coalesce(t.claimed_at, t.created_at),
    term_end   = s.current_period_end
from public.subscriptions s
where s.account_id = t.account_id
  and t.account_id is not null
  and t.term_end is null
  and coalesce(s.plan_code, 'free') <> 'free'
  and s.current_period_end is not null;

-- Segment follows holdings. Commercial is never inferred — it is a negotiated
-- relationship, so it is only ever set by hand.
update public.accounts a
set segment = case
  when (
    select count(*) from public.nfc_tags t where t.account_id = a.id
  ) > 1 then 'business'
  else 'professional'
end
where a.segment = 'professional';

-- NOTE for the operator: a paid account holding ZERO claimed devices converts to
-- no identities at all and therefore to free entitlements. That is not silently
-- correct — it needs a decision per account. The Phase 0 reconciliation query
-- lists exactly those accounts; nothing here invents an identity for a device
-- that does not physically exist.
