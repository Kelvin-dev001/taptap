-- Hornbill TapTap — the LEGACY batch has already arrived
--
-- WHY: 0021's adoption put pre-Sprint-8 tokens straight into `in_stock`, which is
-- correct — those cards were minted and encoded by hand months ago and are
-- physically in the building. But it never set `received_at` on the LEGACY batch
-- it created them under, because the batch was invented in the same statement.
--
-- The consequence is only cosmetic and only in one place, which is why it is a
-- separate migration rather than an edit to 0021: `/admin/stock` badges a batch
-- by `received_at`, so LEGACY reads "At supplier" while every card under it sits
-- on the shelf. A staff member trusting that badge would go looking for a box
-- that arrived last year.
--
-- 0021 is left exactly as it was applied. Editing a migration that has already
-- run means a rebuilt database and production stop matching, which is a far
-- worse problem than a wrong badge.

update public.card_batches b
  set received_at = coalesce(
    received_at,
    -- The oldest card in the batch is the best evidence we have of when these
    -- actually turned up. Falling back to now() for a batch with no cards.
    (select min(t.created_at) from public.nfc_tags t where t.batch_id = b.id),
    now()
  )
where b.received_at is null
  and exists (
    select 1 from public.nfc_tags t
    where t.batch_id = b.id
      and t.stock_state in ('in_stock', 'allocated')
  );
