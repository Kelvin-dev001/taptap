/**
 * Renewal reminder emails.
 *
 * Pure on purpose, exactly like `lead-email.ts`: which milestone a device is at,
 * what the message says, and what makes two reminders "the same" are all
 * decidable without a network, an API key or a clock we do not control.
 */

import {
  GRACE_DAYS,
  RENEWAL_WARNING_DAYS,
  DEVICE_LABELS,
  RENEWAL_PER_IDENTITY_KES,
  formatKes,
  type DeviceKind,
} from "@/lib/pricing";
import { renewalAmountKes, daysUntil } from "@/lib/identity";
import { escapeHtml } from "./lead-email";

/**
 * The four moments worth an email.
 *
 * Each is a WINDOW rather than an exact day, so a cron outage self-heals: a run
 * missed on day 30 still sends the T30 notice on day 29. The dedupe key stops
 * the recovered run from also sending the ones it already sent.
 */
export type RenewalMilestone = "T30" | "T7" | "T0" | "stopped";

export type IdentityForEmail = {
  id: string;
  label?: string | null;
  kind?: DeviceKind | string | null;
  termEnd: string;
};

export function milestoneFor(
  termEnd: string | null | undefined,
  now: Date = new Date(),
): RenewalMilestone | null {
  const remaining = daysUntil(termEnd, now);
  if (remaining === null) return null;
  if (remaining > RENEWAL_WARNING_DAYS) return null;
  if (remaining > 7) return "T30";
  if (remaining > 0) return "T7";
  // Still inside the grace window: the device is working, but the term has run out.
  if (remaining > -GRACE_DAYS) return "T0";
  return "stopped";
}

/**
 * What makes two reminders the same reminder.
 *
 * The TERM is part of the key, not just the device — a card renewed for another
 * year must be able to receive next year's T30 notice, and a key of
 * device+milestone alone would silence it forever after year one.
 */
export function renewalDedupeKey(
  identityId: string,
  termEnd: string,
  milestone: RenewalMilestone,
): string {
  const day = termEnd.slice(0, 10);
  return `renewal:${identityId}:${day}:${milestone}`;
}

export type RenewalEmailInput = {
  businessName: string;
  milestone: RenewalMilestone;
  identities: IdentityForEmail[];
  siteUrl: string;
};

export type ComposedEmail = { subject: string; text: string; html: string };

function deviceName(identity: IdentityForEmail): string {
  const label = identity.label?.trim();
  if (label) return label;
  const kind = (identity.kind as DeviceKind) ?? "card";
  return DEVICE_LABELS[kind] ?? DEVICE_LABELS.card;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Subject and lead line per milestone.
 *
 * The wording gets more concrete as the date approaches, and the last two say
 * plainly what happens rather than softening it. Someone who half-understands a
 * billing warning is more annoyed later, not less.
 */
function wording(
  milestone: RenewalMilestone,
  count: number,
  businessName: string,
  when: string,
) {
  const devices = plural(count, "card", `${count} cards`);
  const theyThem = plural(count, "it", "they");

  switch (milestone) {
    case "T30":
      return {
        subject: `Your TapTap ${plural(count, "card renews", "cards renew")} on ${when}`,
        eyebrow: "Renewal due soon",
        headline: `Your ${devices} ${plural(count, "renews", "renew")} on ${when}`,
        lead: `A month's notice so nothing catches you out. ${businessName} can renew any time before then — renewing early adds a year rather than losing the time you have already paid for.`,
      };
    case "T7":
      return {
        subject: `7 days: your TapTap ${plural(count, "card", "cards")} ${plural(count, "renews", "renew")} on ${when}`,
        eyebrow: "One week left",
        headline: `Your ${devices} ${plural(count, "renews", "renew")} on ${when}`,
        lead: `A week to go. If ${theyThem} ${plural(count, "is", "are")} not renewed, ${theyThem} will keep working for ${GRACE_DAYS} days after that date and then stop.`,
      };
    case "T0":
      return {
        subject: `Renewal due today for your TapTap ${plural(count, "card", "cards")}`,
        eyebrow: "Due now",
        headline: `Your ${devices} ${plural(count, "is", "are")} due for renewal`,
        lead: `${plural(count, "It is", "They are")} still working, and will keep working for ${GRACE_DAYS} days. After that, anyone tapping ${theyThem} sees a renewal notice instead of your profile.`,
      };
    case "stopped":
      return {
        subject: `Your TapTap ${plural(count, "card has", "cards have")} stopped working`,
        eyebrow: "Not active",
        headline: `Your ${devices} ${plural(count, "has", "have")} stopped working`,
        lead: `Anyone tapping ${theyThem} now sees a renewal notice instead of your profile. Nothing has been deleted — renewing brings ${theyThem} back immediately, with all your content and analytics exactly as they were.`,
      };
  }
}

export function composeRenewalEmail(input: RenewalEmailInput): ComposedEmail {
  const { businessName, milestone, identities, siteUrl } = input;
  const count = identities.length;
  const amount = renewalAmountKes(count);
  const billingUrl = `${siteUrl.replace(/\/+$/, "")}/dashboard/billing`;

  // Every device in one email shares a milestone, but not necessarily a date.
  // The earliest is the one that matters — it is the first thing to stop.
  const earliest = identities
    .map((i) => i.termEnd)
    .sort()[0];
  const when = formatDate(earliest);

  const { subject, eyebrow, headline, lead } = wording(
    milestone,
    count,
    businessName,
    when,
  );

  const rows = identities.map(
    (i) => [deviceName(i), formatDate(i.termEnd)] as [string, string],
  );

  const priceLine = `${count} × ${formatKes(RENEWAL_PER_IDENTITY_KES)} = ${formatKes(amount)} for the year`;

  const text = [
    headline,
    "",
    lead,
    "",
    ...rows.map(([name, date]) => `${name} — ${date}`),
    "",
    priceLine,
    `Renew: ${billingUrl}`,
    "",
    "Payment is a one-off M-Pesa prompt to the number you enter. Nothing renews",
    "automatically and no card details are stored.",
  ].join("\n");

  const rowsHtml = rows
    .map(
      ([name, date]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#141414;font-size:14px">${escapeHtml(
          name,
        )}</td><td style="padding:6px 0;color:#6b6b6b;font-size:14px;white-space:nowrap">${escapeHtml(
          date,
        )}</td></tr>`,
    )
    .join("");

  const accent = milestone === "stopped" ? "#B42318" : "#C2560A";

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${accent}">${escapeHtml(
      eyebrow,
    )}</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#141414">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#4b4b4b">${escapeHtml(
      lead,
    )}</p>
    <table style="border-collapse:collapse;width:100%">${rowsHtml}</table>
    <p style="margin:16px 0 20px;font-size:14px;color:#141414;font-weight:500">${escapeHtml(
      priceLine,
    )}</p>
    <a href="${escapeHtml(
      billingUrl,
    )}" style="display:inline-block;padding:10px 16px;background:${accent};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Renew ${escapeHtml(
      plural(count, "this card", "these cards"),
    )}</a>
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e8e8e8;font-size:13px;line-height:1.5;color:#6b6b6b">
      Payment is a one-off M-Pesa prompt to the number you enter. Nothing renews automatically
      and no card details are stored.
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}
