// M-Pesa Daraja STK push. Server-only (uses Node Buffer + secret credentials).

const BASE =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

/** Normalize a Kenyan number to Daraja format 2547XXXXXXXX / 2541XXXXXXXX. */
export function normalizePhone(input: string): string | null {
  const d = (input || "").replace(/\D/g, "");
  if (/^254(7|1)\d{8}$/.test(d)) return d;
  if (/^0(7|1)\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^(7|1)\d{8}$/.test(d)) return "254" + d;
  return null;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

async function getToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("M-Pesa credentials not configured.");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(
    `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" },
  );
  if (!res.ok) throw new Error("M-Pesa auth failed.");
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("M-Pesa auth returned no token.");
  return j.access_token;
}

export async function stkPush(opts: {
  phone: string;
  amount: number;
  accountRef: string;
  description?: string;
}): Promise<{ checkoutRequestId: string; raw: unknown }> {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  if (!shortcode || !passkey) {
    throw new Error("M-Pesa shortcode/passkey not configured.");
  }
  const token = await getToken();
  const ts = timestamp();
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");
  const callback =
    process.env.MPESA_CALLBACK_URL ||
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/mpesa/callback`;

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: opts.amount,
    PartyA: opts.phone,
    PartyB: shortcode,
    PhoneNumber: opts.phone,
    CallBackURL: callback,
    AccountReference: opts.accountRef.slice(0, 12),
    TransactionDesc: (opts.description || "TapTap").slice(0, 13),
  };

  const res = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const raw = (await res.json()) as {
    CheckoutRequestID?: string;
    errorMessage?: string;
  };
  if (!res.ok || !raw.CheckoutRequestID) {
    throw new Error(raw.errorMessage || "STK push failed.");
  }
  return { checkoutRequestId: raw.CheckoutRequestID, raw };
}
