-- Hornbill TapTap — Sprint 4: billing (payments + subscription columns)

-- Extend subscriptions with the plan code and an external reference.
alter table public.subscriptions
  add column if not exists plan_code text not null default 'free';
alter table public.subscriptions
  add column if not exists external_ref text;

-- Payments: one row per initiated checkout. Written server-side (service role);
-- owners can read their own. Reference = provider checkout id (unique, idempotency key).
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  plan_code   text not null,
  provider    text not null,                       -- 'mpesa' | 'paystack'
  reference   text not null unique,                -- e.g. M-Pesa CheckoutRequestID
  amount      int not null,
  currency    text not null default 'KES',
  status      text not null default 'pending'
              check (status in ('pending', 'paid', 'failed')),
  raw         jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists payments_account_idx on public.payments(account_id, created_at desc);

alter table public.payments enable row level security;

-- Owners can read their own payments. No insert/update policy — writes go through the
-- server (service-role client) so amounts/status can't be tampered with by clients.
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select using (
    account_id in (select account_id from public.profiles where id = auth.uid())
  );
