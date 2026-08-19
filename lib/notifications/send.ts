/**
 * Resend transport.
 *
 * A plain fetch rather than the `resend` SDK: the API is one POST, the SDK adds
 * a dependency for no capability we need (§30.4), and fetch works unchanged on
 * the edge runtime where /api/lead runs.
 */

export type SendResult =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string };

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Never throws. A notification failure must not become a lead failure — the
 * lead is already saved by the time this runs, and an exception escaping here
 * would turn a missed email into a 500 on a customer's form.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;

  // Not configured is a normal state (local dev, a fresh preview), not an
  // error worth alarming about — but it must be reported, never silently
  // treated as sent.
  if (!key) return { ok: false, error: "RESEND_API_KEY is not configured" };
  if (!from) return { ok: false, error: "NOTIFY_FROM is not configured" };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    const body = (await res.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!res.ok) {
      // Resend puts the reason in `message`; fall back to the status so a
      // failure is never recorded as an empty string.
      return { ok: false, error: body?.message ?? `Resend returned ${res.status}` };
    }

    // `ok` here means Resend accepted it for delivery — not that anyone read
    // it, and not that it escaped a spam filter. The delivery log records
    // exactly this and no more (§15).
    return { ok: true, providerId: body?.id ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}
