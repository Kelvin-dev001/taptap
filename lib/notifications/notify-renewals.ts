import { createAdminClient } from "@/lib/supabase/admin";
import {
  milestoneFor,
  renewalDedupeKey,
  composeRenewalEmail,
  type IdentityForEmail,
  type RenewalMilestone,
} from "./renewal-email";
import { sendEmail } from "./send";

/** Shape returned by the renewal_notification_targets RPC (migration 0016). */
type Target = {
  accountId: string;
  businessName: string | null;
  ownerEmail: string | null;
  identities: IdentityForEmail[];
};

export type RenewalRunSummary = {
  accountsExamined: number;
  identitiesExamined: number;
  emailsSent: number;
  emailsFailed: number;
  alreadySent: number;
  skipped: { accountId: string; reason: string }[];
  errors: string[];
};

/**
 * How far ahead to look. Comfortably past the 30-day milestone so a device
 * crossing the boundary between runs is never missed.
 */
const HORIZON_DAYS = 45;

/**
 * Send every renewal reminder that is due and has not already been sent.
 *
 * Reminders are **transactional, not optional**. There is no preference to turn
 * them off, deliberately: the `notify.lead` toggle governs a high-volume stream
 * a business might reasonably not want, whereas this one says a thing they paid
 * for is about to stop working. Letting someone switch that off is how a card
 * dies silently in a customer's hand, which is the exact failure D-018's grace
 * window exists to prevent.
 *
 * Never throws. A cron run that dies halfway would leave the remaining accounts
 * unnotified with nothing recorded, so every failure is captured per-account and
 * the run continues.
 */
export async function notifyDueRenewals(now: Date = new Date()): Promise<RenewalRunSummary> {
  const summary: RenewalRunSummary = {
    accountsExamined: 0,
    identitiesExamined: 0,
    emailsSent: 0,
    emailsFailed: 0,
    alreadySent: 0,
    skipped: [],
    errors: [],
  };

  const admin = createAdminClient();

  const { data, error } = await admin.rpc("renewal_notification_targets", {
    p_horizon_days: HORIZON_DAYS,
  });
  if (error) {
    summary.errors.push(error.message);
    return summary;
  }

  const targets = (data ?? []) as Target[];
  summary.accountsExamined = targets.length;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://taptap.hornbilltech.co.ke";

  for (const target of targets) {
    try {
      summary.identitiesExamined += target.identities.length;

      // Group by milestone. A business whose till card renews next month and
      // whose reception card stopped last week has two genuinely different
      // things to be told, and merging them would bury the urgent one.
      const byMilestone = new Map<RenewalMilestone, IdentityForEmail[]>();
      for (const identity of target.identities) {
        const milestone = milestoneFor(identity.termEnd, now);
        if (!milestone) continue;
        const group = byMilestone.get(milestone) ?? [];
        group.push(identity);
        byMilestone.set(milestone, group);
      }
      if (byMilestone.size === 0) continue;

      if (!target.ownerEmail) {
        summary.skipped.push({
          accountId: target.accountId,
          reason: "no owner email address",
        });
        continue;
      }

      for (const [milestone, identities] of byMilestone) {
        // Claim BEFORE sending, one row per device — the same rule as
        // notifyNewLead. The partial unique index on dedupe_key is what makes a
        // concurrent or repeated run safe: the loser's insert fails and it stops
        // rather than sending a second copy.
        const claimed: IdentityForEmail[] = [];
        for (const identity of identities) {
          const { error: claimError } = await admin
            .from("notification_deliveries")
            .insert({
              account_id: target.accountId,
              kind: `renewal_${milestone}`,
              ref_id: identity.id,
              channel: "email",
              status: "failed",
              error: "in flight",
              dedupe_key: renewalDedupeKey(identity.id, identity.termEnd, milestone),
            });

          if (!claimError) {
            claimed.push(identity);
            continue;
          }
          // 23505 = unique_violation: this exact reminder already went out.
          if (claimError.code === "23505") {
            summary.alreadySent += 1;
            continue;
          }
          summary.errors.push(`${target.accountId}: ${claimError.message}`);
        }

        if (claimed.length === 0) continue;

        const composed = composeRenewalEmail({
          businessName: target.businessName ?? "your business",
          milestone,
          identities: claimed,
          siteUrl,
        });

        const result = await sendEmail({ to: target.ownerEmail, ...composed });
        const keys = claimed.map((i) => renewalDedupeKey(i.id, i.termEnd, milestone));

        if (result.ok) {
          // "sent" means Resend accepted it for delivery — not that anyone read
          // it, and not that it cleared a spam filter (§15).
          await admin
            .from("notification_deliveries")
            .update({ status: "sent", provider_id: result.providerId, error: null })
            .in("dedupe_key", keys);
          summary.emailsSent += 1;
        } else {
          // Release the claim so tomorrow's run tries again.
          //
          // This is the one place that deliberately differs from notifyNewLead,
          // which leaves a failed row behind as a record. A lead notification is
          // a single chance and a duplicate would be worse than a miss. A
          // renewal reminder is the opposite: a Resend blip that permanently
          // consumed the "stopped working" notice would let a card die silently
          // in a customer's hand, which is the exact failure this feature
          // exists to prevent. A duplicate reminder is merely annoying.
          //
          // The failure is not lost — it is in the run summary the route
          // returns, and therefore in the cron logs.
          await admin.from("notification_deliveries").delete().in("dedupe_key", keys);
          summary.emailsFailed += 1;
          summary.errors.push(`${target.accountId}: ${result.error}`);
        }
      }
    } catch (err) {
      summary.errors.push(
        `${target.accountId}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  return summary;
}
