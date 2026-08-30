# Customer notice — renewal enforcement change (D-018)

**Status:** drafted 2026-08-30, **not sent**. Kelvin sends this; it is outward-facing.

## Why this has to go out

The old billing screen told customers, in writing:

> "Your existing links and cards keep working — but paid features are unavailable until you
> renew."

That is no longer true. Under D-018 an unrenewed device stops resolving 14 days past its
term, and the page it points at serves a renewal notice instead. Anyone who read the old
copy was told the opposite of what will now happen. Whatever the legal position, sending
this is the difference between a customer who was told and a customer who found out when a
card stopped working in front of their own client.

## Send it to

Every account with a hand-granted paid plan — Magangi & Company plus the others. The Phase 0
reconciliation query (query 1) lists them with their names and current period ends; that is
the send list and the source of each person's date.

**Send before applying `0015`, or immediately after.** Not weeks later.

## Decide before sending

1. **Do you honour the old promise for the current term?** The `0015` backfill already does
   the fair thing — every existing device inherits the period end they were already given,
   so nobody's clock restarts. Enforcement only bites at *their next* renewal. I would say
   that, because it is true and it is the strongest thing in the message.
2. **Anything for the first cohort?** A grace month or a first-renewal discount for
   customers who signed up under the old terms is a reasonable gesture. Entirely your call —
   I have not assumed one, and the draft does not promise anything.
3. **Channel.** Resend deliverability is still unproven (checklist §1). For a handful of
   customers, WhatsApp is more reliable and more normal in this market. A short WhatsApp
   message pointing at a call is probably better than a formal email — a shortened version
   is below.

---

## Email draft

**Subject:** A change to how your TapTap cards renew

Hi [Name],

A short note about something that is changing in how Hornbill TapTap works, so it does not
catch you out later.

**What is changing.** Each TapTap card or stand now carries its own renewal date, and each
one renews at KES 1,000 a year. Previously renewals were handled as one account-wide plan.

**What this means if a renewal is missed.** Until now, a card kept working whether or not it
was paid for. From now on, a card that is not renewed stops working two weeks after its
date — someone tapping it sees a short "this card isn't active right now" message instead of
your profile. Nothing is deleted, and renewing brings it back immediately with all your
content and your analytics exactly as they were.

**What is not changing for you right now.** Your existing cards keep their current date —
[DATE]. You are not being asked to pay anything today, and nothing about your cards or
profiles has changed. The new terms apply from that renewal onward.

**What you will pay then.** [N] cards × KES 1,000 = **KES [N,000] a year**, in one M-Pesa
payment covering all of them. You will see it on your Billing page, and we will remind you
before the date.

I would rather tell you this now than have you find out from a card that stopped working.
If you have any questions — or if the timing is difficult — reply to this message or call me
and we will sort it out.

[Kelvin]
Hornbill TapTap
[phone]

---

## WhatsApp version

> Hi [Name] — quick heads up on TapTap. Each card now renews on its own date at KES 1,000/
> year. Your cards are paid until [DATE] and nothing changes before then. The one thing worth
> knowing: from now on a card that isn't renewed stops working two weeks after its date —
> people tapping it see a "card not active" message instead of your profile. Nothing gets
> deleted and renewing brings it straight back. I'll remind you before [DATE]. Any questions,
> just call me.

---

## The reminder promise is now real

The draft says "we will remind you before the date". That was a promise with nothing behind
it when this was written; it is now built (migration `0016`, daily cron). Reminders go out
at 30 days, 7 days, on the day, and again if a card actually stops. They ride on Resend, so
checklist §1 gates them — if deliverability is unproven, so are the reminders, and the
sentence should come out of the notice until it is.

## Notes on the drafting

- **Leads with what changes for them, not with our model.** "Per-identity billing" is our
  word for it and means nothing to a customer.
- **States the consequence plainly** rather than softening it. Someone who half-understands
  this will be more annoyed later, not less.
- **Says what is not changing** immediately after, because the consequence lands hard and
  the honest reassurance is real: their current term is untouched.
- **Names the amount.** A customer who has to work out `3 × 1,000` themselves will assume
  the worst number.
- **Does not apologise** for having a business model, and does not hide behind "updated
  terms of service".
- **Offers a way out** — "if the timing is difficult" — because for a first cohort of
  hand-signed customers, the relationship is worth more than one renewal.
