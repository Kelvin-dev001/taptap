-- Hornbill TapTap — give the untermed identities a term
--
-- WHY: four claimed, working, actively-tapped cards carry `term_end = NULL`.
-- `identity_is_live` (0015) treats NULL as live unconditionally and forever —
-- a deliberate fail-open so a backfill could never darken a card in somebody's
-- hand. The consequence is that these four never appear in a renewal batch,
-- never receive a reminder, and are never billed.
--
-- They are not dormant. Between them they carry a few hundred taps and three of
-- the four were used within days of this migration being written. They are real
-- businesses that were never told they owed anything, which is why this sets a
-- FUTURE date rather than backdating one: a card that stops working in front of
-- the cardholder's customer is the exact failure D-018's grace window exists to
-- prevent, and doing it to someone who believed the thing was free is worse.
--
-- 31 December 2026 puts the first reminder (T30, renewal-email.ts) in the first
-- days of December, a week of notice at T7 before the year turns, and the
-- fourteen-day grace running to roughly 14 January. Nobody loses a card without
-- two emails and six weeks.
--
-- `term_start` is each identity's own claim date rather than today, because that
-- is when the customer actually started using it, and a start date that says
-- otherwise is a record that lies.
--
-- SCOPED BY PREDICATE, NOT BY ID. Anything claimed, not disabled, not a
-- placeholder and carrying no term is by definition an identity that slipped
-- past billing — which is the set this is for, whether it is four rows or five.
-- Paid identities already have a term and are not touched: Magangi's three run
-- to 2027-08-15 and this cannot move them.
update public.nfc_tags
  set term_start = coalesce(term_start, claimed_at, created_at),
      term_end   = timestamptz '2026-12-31 23:59:59+00'
where account_id is not null
  and term_end is null
  and status <> 'disabled'
  and is_placeholder = false;
