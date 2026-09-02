// M-Pesa Daraja STK push. Server-only (uses Node Buffer + secret credentials).

/**
 * Values that are obviously not credentials, however they are cased.
 *
 * The same class of bug `lib/admin-auth.ts` was written to close, and it cost an
 * hour before it was recognised: `.env.local` held `PASTE_YOUR_CONSUMER_KEY`
 * verbatim, Daraja answered 400 with an empty body, and the app reported only
 * "M-Pesa auth failed." Nothing said the credentials had never been filled in.
 */
const PLACEHOLDER_PATTERNS = [
  "paste_your",
  "your-",
  "your_",
  "change-me",
  "changeme",
  "replace",
  "xxxx",
  "todo",
];

export function isPlaceholderCredential(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.length === 0) return true;
  return PLACEHOLDER_PATTERNS.some((p) => v.includes(p));
}

/**
 * Resolve and validate the Daraja environment.
 *
 * Strict rather than "anything that isn't production means sandbox". That
 * default is safe in one direction and dangerous in the other: a typo like
 * `prodution` would silently run live payments against the sandbox, and the
 * failure would look like customers not being charged rather than like a
 * misconfiguration.
 */
export function mpesaBaseUrl(env: string | undefined = process.env.MPESA_ENV): string {
  const mode = (env ?? "sandbox").trim().toLowerCase();
  if (mode === "production") return "https://api.safaricom.co.ke";
  if (mode === "sandbox") return "https://sandbox.safaricom.co.ke";
  throw new Error(
    `MPESA_ENV must be exactly "sandbox" or "production" — got "${env}". ` +
      "Refusing to guess which one you meant when real money is involved.",
  );
}

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

  // Named individually so the message says WHICH one to go and fix.
  const unset = [
    isPlaceholderCredential(key) && "MPESA_CONSUMER_KEY",
    isPlaceholderCredential(secret) && "MPESA_CONSUMER_SECRET",
  ].filter(Boolean);
  if (unset.length > 0) {
    throw new Error(
      `${unset.join(" and ")} still hold the placeholder from .env.example. ` +
        "Get real values from developer.safaricom.co.ke and put them in .env.local.",
    );
  }

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(
    `${mpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" },
  );

  if (!res.ok) {
    // Daraja answers a bad key with 400 and an EMPTY body, so the status is
    // most of what there is to go on — and discarding it, as this used to,
    // leaves "auth failed" with no way to tell a wrong key from an outage.
    // Never echoes the credentials; only what came back.
    const detail = (await res.text().catch(() => "")).trim().slice(0, 200);
    throw new Error(
      `M-Pesa auth failed (HTTP ${res.status}${detail ? `: ${detail}` : ", empty body"}). ` +
        "A 400 here almost always means the consumer key or secret is wrong.",
    );
  }

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

  const res = await fetch(`${mpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
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

/**
 * What Daraja says happened to an STK prompt.
 *
 * `unknown` is a first-class answer and the most common one: Safaricom returns
 * an error while the customer still has the prompt on screen, and treating that
 * as a failure would tell someone their payment had failed while they were
 * typing their PIN. Only a definite ResultCode resolves anything.
 */
export type StkOutcome =
  | { state: "paid"; resultCode: number; raw: unknown }
  | { state: "failed"; resultCode: number; description: string; raw: unknown }
  | { state: "unknown"; raw: unknown };

/**
 * Ask Daraja what became of a checkout (STK push query).
 *
 * The callback is the primary path and this is the safety net. Kenyan networks
 * drop callbacks, and a customer staring at a spinner that will never resolve is
 * how a paid order ends up looking unpaid — so the UI asks rather than waits.
 *
 * Never throws for a business outcome; only for a configuration or transport
 * failure, which is a different kind of problem and deserves a different
 * message.
 */
export async function stkQuery(checkoutRequestId: string): Promise<StkOutcome> {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  if (!shortcode || !passkey) {
    throw new Error("M-Pesa shortcode/passkey not configured.");
  }

  const token = await getToken();
  const ts = timestamp();
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");

  const res = await fetch(`${mpesaBaseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
    cache: "no-store",
  });

  const raw = (await res.json().catch(() => ({}))) as {
    ResultCode?: string | number;
    ResultDesc?: string;
    errorCode?: string;
    errorMessage?: string;
  };

  return readStkOutcome(raw);
}

/**
 * Turn a Daraja query response into an outcome.
 *
 * Split out from the fetch so the decision is testable without a network, which
 * matters because the interesting cases are all shapes of response rather than
 * shapes of request.
 *
 * `ResultCode` arrives as a STRING from the query endpoint and as a NUMBER from
 * the callback, which is exactly the sort of difference that produces a
 * never-resolving spinner if you compare with `===`.
 */
export function readStkOutcome(raw: unknown): StkOutcome {
  const body = (raw ?? {}) as {
    ResultCode?: string | number;
    ResultDesc?: string;
  };

  if (body.ResultCode === undefined || body.ResultCode === null || body.ResultCode === "") {
    // No verdict. Daraja answers "transaction is being processed" as an error
    // object with no ResultCode while the prompt is still on the phone.
    return { state: "unknown", raw };
  }

  const code = Number(body.ResultCode);
  if (!Number.isFinite(code)) return { state: "unknown", raw };
  if (code === 0) return { state: "paid", resultCode: code, raw };

  return {
    state: "failed",
    resultCode: code,
    description: body.ResultDesc || describeStkFailure(code),
    raw,
  };
}

/**
 * Daraja's failure codes in words a customer can act on.
 *
 * Safaricom's own descriptions are written for developers ("The balance is
 * insufficient for the transaction"), which is close enough to keep, but the
 * common ones are worth saying plainly because they are the difference between
 * a customer retrying and a customer giving up.
 */
export function describeStkFailure(code: number): string {
  switch (code) {
    case 1:
      return "There was not enough money in the M-Pesa account.";
    case 1032:
      return "The prompt was cancelled on the phone.";
    case 1037:
      return "The prompt timed out. It may not have reached the phone.";
    case 2001:
      return "The M-Pesa PIN was wrong.";
    case 1001:
      return "Another M-Pesa transaction is in progress on that number. Wait a moment and try again.";
    default:
      return "M-Pesa did not complete the payment.";
  }
}
