import { DISPATCH_METHOD_META, type DispatchMethod } from "@/lib/orders";
import { escapeHtml } from "./lead-email";

export type ComposedEmail = { subject: string; text: string; html: string };

export type DispatchEmailInput = {
  businessName: string;
  orderNumber: string;
  quantity: number;
  productName: string;
  method: DispatchMethod;
  /** Rider name and number, waybill, or shuttle parcel reference. May be absent. */
  reference: string | null;
  /** Where it is going, as the customer gave it. */
  destination: string | null;
  siteUrl: string;
};

/**
 * "Your card is on its way."
 *
 * The reference is the whole point of this email. A customer who knows a parcel
 * has left learns nothing they can act on; a customer who has the rider's number
 * can phone the person holding it. So the reference is the headline fact, not a
 * footnote, and when there is none the email says so plainly rather than leaving
 * a blank where a number should be.
 *
 * Pure, so the wording is tested without a network or a database, exactly like
 * `composeRenewalEmail`. No em dashes: this is customer copy.
 */
export function composeDispatchEmail(input: DispatchEmailInput): ComposedEmail {
  const { businessName, orderNumber, quantity, productName, method, siteUrl } = input;
  const meta = DISPATCH_METHOD_META[method];
  const reference = input.reference?.trim() || null;
  const destination = input.destination?.trim() || null;

  const ordersUrl = `${siteUrl.replace(/\/+$/, "")}/dashboard/orders`;

  const thing = quantity === 1 ? productName : `${quantity} × ${productName}`;
  const subject = quantity === 1 ? "Your TapTap card is on its way" : "Your TapTap order is on its way";
  const headline = `${thing} sent ${meta.customerNoun}`;

  const lead = destination
    ? `${businessName}, your order ${orderNumber} has left us and is on its way to ${destination}.`
    : `${businessName}, your order ${orderNumber} has left us and is on its way.`;

  // Named after what the reference actually is, so "Waybill number" appears over
  // a waybill and "Rider name and phone" over a phone number. One generic
  // "Reference" label would make the customer guess what to do with it.
  const referenceBlock = reference
    ? `${meta.referenceLabel}: ${reference}`
    : "We will send you the tracking details shortly.";

  const firstTap = [
    "When it arrives, tap it to bring it to life.",
    "Android: tap the back of your phone. iPhone: tap near the top.",
    "No NFC? Scan the QR on the back.",
  ].join(" ");

  const text = [
    headline,
    "",
    lead,
    "",
    referenceBlock,
    "",
    firstTap,
    "",
    `Track this order: ${ordersUrl}`,
  ].join("\n");

  const accent = "#C2560A";

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8e8e8;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${accent}">On its way</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#141414">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#4b4b4b">${escapeHtml(lead)}</p>
    <p style="margin:0 0 20px;padding:12px 14px;background:#fafafa;border:1px solid #e8e8e8;border-radius:8px;font-size:14px;color:#141414">${escapeHtml(
      referenceBlock,
    )}</p>
    <a href="${escapeHtml(
      ordersUrl,
    )}" style="display:inline-block;padding:10px 16px;background:${accent};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Track this order</a>
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e8e8e8;font-size:13px;line-height:1.5;color:#6b6b6b">
      ${escapeHtml(firstTap)}
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}
