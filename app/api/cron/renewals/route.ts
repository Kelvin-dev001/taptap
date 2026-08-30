import { notifyDueRenewals } from "@/lib/notifications/notify-renewals";
import { timingSafeEqualString, isWeakAdminToken } from "@/lib/admin-auth";

/**
 * Daily renewal reminders (D-018).
 *
 * Scheduled by Vercel Cron — see `vercel.json`. Vercel sends
 * `Authorization: Bearer $CRON_SECRET` on every scheduled invocation, and this
 * route refuses everything else: the endpoint sends real email to real
 * customers, so an open URL would be a spam cannon anyone could fire.
 *
 * Runs daily rather than on each milestone's exact day. The milestones are
 * windows and every send is deduplicated by term, so a missed run self-heals on
 * the next one instead of losing a notice permanently.
 */
export const dynamic = "force-dynamic";

// Comfortably inside Vercel's 300s default; the work is a handful of small
// requests per account, not a scan.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // A missing secret must FAIL CLOSED. Treating "not configured" as "allow"
  // would mean a preview deployment without the variable set is an open
  // send-email-to-customers endpoint.
  if (!secret) {
    return json({ error: "CRON_SECRET is not configured" }, 503);
  }

  // Same rule as ADMIN_TOKEN: a placeholder copied out of `.env.example` is not
  // a secret, and pretending otherwise leaves a published key guarding a live
  // endpoint. Vercel generates a strong value by default, so this only bites on
  // a hand-set one.
  if (isWeakAdminToken(secret)) {
    return json({ error: "CRON_SECRET is a placeholder or too short" }, 503);
  }

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!timingSafeEqualString(provided, expected)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const summary = await notifyDueRenewals();

  // Always 200 when the run itself completed, even with per-account failures —
  // the summary carries them. A non-2xx would make Vercel report the whole run
  // as broken when most of it worked.
  return json({ ok: true, ...summary }, 200);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
