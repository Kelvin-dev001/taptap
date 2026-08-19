import { createAdminClient } from "@/lib/supabase/admin";
import { composeLeadEmail, type LeadForEmail } from "./lead-email";
import { sendEmail } from "./send";

/** Shape returned by the lead_notification_target RPC (migration 0014). */
type Target = {
  accountId: string;
  businessName: string;
  notify: { lead?: { enabled?: boolean; to?: string | null } } | null;
  slug: string;
  pageTitle: string | null;
  ownerEmail: string | null;
  lead: LeadForEmail;
};

export type NotifyOutcome =
  | { status: "sent"; to: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Notifications are opt-OUT.
 *
 * A business that has never opened Settings is exactly the one that most needs
 * telling a lead arrived, so an absent preference means on. Only an explicit
 * `enabled: false` turns it off.
 */
export function leadEmailEnabled(notify: Target["notify"]): boolean {
  return notify?.lead?.enabled !== false;
}

/**
 * Who gets it: the address they chose, else the owner's verified sign-up
 * address. A custom address is the account's own decision about where their
 * customers' details are routed — they are the data controller.
 */
export function leadEmailRecipient(target: Pick<Target, "notify" | "ownerEmail">): string | null {
  const custom = target.notify?.lead?.to?.trim();
  return custom || target.ownerEmail?.trim() || null;
}

/**
 * Send the new-lead notification for one lead.
 *
 * Never throws. Called after the response has been returned to the person who
 * submitted the form, so there is nobody left to show an error to — the outcome
 * is recorded in notification_deliveries instead.
 */
export async function notifyNewLead(leadId: string): Promise<NotifyOutcome> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("lead_notification_target", {
      p_lead_id: leadId,
    });
    if (error) return { status: "failed", error: error.message };
    const target = data as Target | null;
    if (!target) return { status: "skipped", reason: "lead not found" };

    if (!leadEmailEnabled(target.notify)) {
      return { status: "skipped", reason: "disabled by the account" };
    }

    const to = leadEmailRecipient(target);
    if (!to) return { status: "skipped", reason: "no recipient address" };

    // Claim the send BEFORE performing it. The unique constraint on
    // (kind, ref_id, channel) is what makes this safe: if two requests race, or
    // a retry arrives, exactly one insert succeeds and the loser stops here
    // rather than sending a duplicate. Claiming afterwards would leave a window
    // where both have already sent.
    const { error: claimError } = await admin.from("notification_deliveries").insert({
      account_id: target.accountId,
      kind: "lead",
      ref_id: leadId,
      channel: "email",
      status: "failed",
      error: "in flight",
    });
    if (claimError) {
      // 23505 = unique_violation: someone else already has this one.
      if (claimError.code === "23505") {
        return { status: "skipped", reason: "already notified" };
      }
      return { status: "failed", error: claimError.message };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://taptap.hornbilltech.co.ke";
    const composed = composeLeadEmail({
      lead: target.lead,
      businessName: target.businessName,
      slug: target.slug,
      pageTitle: target.pageTitle,
      siteUrl,
    });

    const result = await sendEmail({ to, ...composed });

    // Record what the provider actually said. "sent" here means Resend accepted
    // it — not that it was read, and not that it cleared a spam filter.
    await admin
      .from("notification_deliveries")
      .update(
        result.ok
          ? { status: "sent", provider_id: result.providerId, error: null }
          : { status: "failed", error: result.error },
      )
      .eq("kind", "lead")
      .eq("ref_id", leadId)
      .eq("channel", "email");

    return result.ok ? { status: "sent", to } : { status: "failed", error: result.error };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "notification failed",
    };
  }
}
