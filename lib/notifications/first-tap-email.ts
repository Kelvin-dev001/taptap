import { escapeHtml } from "./lead-email";

export type ComposedEmail = { subject: string; text: string; html: string };

export type FirstTapEmailInput = {
  businessName: string;
  orderNumber: string;
  quantity: number;
  productName: string;
  /** The profile the card opens, for the analytics link. May be absent. */
  slug: string | null;
  siteUrl: string;
};

/**
 * "Your TapTap card is live."
 *
 * Sent on the first tap after dispatch, which is the moment the thing they
 * bought stops being a parcel and starts being a product. It is a congratulation
 * and a pointer, not a receipt: the receipt already went out at payment and the
 * tracking reference at dispatch.
 *
 * It claims exactly one tap, because exactly one tap is what happened. Saying
 * "your card is getting taps" off the back of a single interaction would be the
 * fabrication §15 forbids, and the customer would find out at a glance.
 *
 * Pure, so the wording is tested without a network or a database. No em dashes:
 * this is customer copy.
 */
export function composeFirstTapEmail(input: FirstTapEmailInput): ComposedEmail {
  const { businessName, orderNumber, quantity, productName, siteUrl } = input;
  const slug = input.slug?.trim() || null;

  const base = siteUrl.replace(/\/+$/, "");
  // Without a profile there is nothing card-specific to show, so the dashboard
  // is the honest destination rather than a deep link that 404s.
  const analyticsUrl = slug ? `${base}/dashboard/analytics` : `${base}/dashboard`;
  const profileUrl = slug ? `${base}/${slug}` : null;

  const thing = quantity === 1 ? productName : `${quantity} × ${productName}`;
  const subject =
    quantity === 1 ? "Your TapTap card is live" : "Your TapTap cards are live";
  const headline = "Your card just got its first tap";

  const lead = `${businessName}, somebody tapped your ${thing} for the first time. It arrived, it works, and you are live.`;

  const closing =
    "We have marked the order delivered. If it has not actually reached you, reply to this email and we will chase it.";

  const text = [
    headline,
    "",
    lead,
    "",
    profileUrl ? `Your profile: ${profileUrl}` : null,
    `See what happens next: ${analyticsUrl}`,
    "",
    `Order ${orderNumber}`,
    "",
    closing,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const accent = "#C2560A";

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${accent}">You are live</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#141414">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#4b4b4b">${escapeHtml(lead)}</p>
    ${
      profileUrl
        ? `<p style="margin:0 0 20px;padding:12px 14px;background:#fafafa;border:1px solid #e8e8e8;border-radius:8px;font-size:14px;color:#141414">${escapeHtml(
            profileUrl,
          )}</p>`
        : ""
    }
    <a href="${escapeHtml(
      analyticsUrl,
    )}" style="display:inline-block;padding:10px 16px;background:${accent};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">See your analytics</a>
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e8e8e8;font-size:13px;line-height:1.5;color:#6b6b6b">
      ${escapeHtml(`Order ${orderNumber}. ${closing}`)}
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}
