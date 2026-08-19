/**
 * The new-lead email.
 *
 * Pure on purpose: composing the message and sending it are separate concerns,
 * so every claim this makes about content — what appears, what is escaped, what
 * happens when a field is missing — is testable without a network or an API key.
 */

export type LeadForEmail = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  message?: string | null;
  createdAt?: string | null;
};

export type LeadEmailInput = {
  lead: LeadForEmail;
  businessName: string;
  /** Slug of the profile the lead came through, so an owner with several knows which. */
  slug: string;
  pageTitle?: string | null;
  /** Absolute base URL, for the link back into the dashboard. */
  siteUrl: string;
};

export type ComposedEmail = { subject: string; text: string; html: string };

/**
 * The lead's own words end up inside an HTML document, so they are escaped.
 * A message containing `<script>` or a stray `<` is not an attack we expect,
 * but the cost of being wrong is markup executing in the owner's mail client.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Digits-only international form, so a tel: link works from any country. */
function telHref(phone: string): string {
  const d = phone.replace(/[^\d]/g, "");
  if (phone.trim().startsWith("+") || d.startsWith("254")) return `+${d}`;
  if (d.startsWith("0")) return `+254${d.slice(1)}`;
  return `+${d}`;
}

/** wa.me rejects a leading zero — same rule as lib/blocks.ts. */
function waHref(phone: string): string {
  return `https://wa.me/${telHref(phone).replace(/[^\d]/g, "")}`;
}

function displayName(lead: LeadForEmail): string {
  return lead.name?.trim() || lead.phone?.trim() || lead.email?.trim() || "Someone";
}

/**
 * Compose the notification.
 *
 * The details are in the body rather than behind a link because the point is to
 * make the follow-up immediate: an owner reading this on a phone can tap to call
 * or open WhatsApp without signing in to anything. A "you have a new lead" stub
 * would just move the delay rather than remove it.
 */
export function composeLeadEmail(input: LeadEmailInput): ComposedEmail {
  const { lead, businessName, slug, pageTitle, siteUrl } = input;
  const who = displayName(lead);
  const via = pageTitle?.trim() || `/${slug}`;
  const leadsUrl = `${siteUrl.replace(/\/+$/, "")}/dashboard/customers`;

  const subject = `New lead for ${businessName}: ${who}`;

  // Only rows with a value. An empty "Phone: —" wastes the most valuable line
  // of a phone notification preview.
  const rows: Array<[string, string]> = [];
  if (lead.name?.trim()) rows.push(["Name", lead.name.trim()]);
  if (lead.phone?.trim()) rows.push(["Phone", lead.phone.trim()]);
  if (lead.email?.trim()) rows.push(["Email", lead.email.trim()]);
  if (lead.company?.trim()) rows.push(["Company", lead.company.trim()]);
  if (lead.message?.trim()) rows.push(["Message", lead.message.trim()]);

  const textLines = [
    `New lead for ${businessName}`,
    `Came through: ${via}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
  ];
  if (lead.phone?.trim()) {
    textLines.push(`Call: ${telHref(lead.phone)}`, `WhatsApp: ${waHref(lead.phone)}`);
  }
  textLines.push(`All leads: ${leadsUrl}`);
  const text = textLines.join("\n");

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b6b6b;font-size:14px;vertical-align:top;white-space:nowrap">${escapeHtml(
          label,
        )}</td><td style="padding:6px 0;color:#141414;font-size:14px">${escapeHtml(
          value,
        ).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");

  const actions: string[] = [];
  if (lead.phone?.trim()) {
    actions.push(
      `<a href="tel:${escapeHtml(telHref(lead.phone))}" style="display:inline-block;padding:10px 16px;margin:0 8px 8px 0;background:#C2560A;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Call ${escapeHtml(
        who,
      )}</a>`,
      `<a href="${escapeHtml(waHref(lead.phone))}" style="display:inline-block;padding:10px 16px;margin:0 8px 8px 0;border:1px solid #d4d4d4;color:#141414;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">WhatsApp</a>`,
    );
  }
  if (lead.email?.trim()) {
    actions.push(
      `<a href="mailto:${escapeHtml(
        lead.email.trim(),
      )}" style="display:inline-block;padding:10px 16px;margin:0 8px 8px 0;border:1px solid #d4d4d4;color:#141414;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Reply by email</a>`,
    );
  }

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b6b6b">New lead</p>
    <h1 style="margin:0 0 4px;font-size:20px;color:#141414">${escapeHtml(who)}</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b6b6b">for ${escapeHtml(
      businessName,
    )} &middot; via ${escapeHtml(via)}</p>
    <table style="border-collapse:collapse;width:100%">${rowsHtml}</table>
    ${actions.length > 0 ? `<div style="margin-top:20px">${actions.join("")}</div>` : ""}
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e8e8e8;font-size:13px;color:#6b6b6b">
      <a href="${escapeHtml(leadsUrl)}" style="color:#C2560A">See all leads</a>
      &middot; Turn these off in Settings &rarr; Notifications
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}
