import Link from "next/link";
import { CircleCheck, Info } from "lucide-react";
import { Card, Badge, Alert, buttonVariants } from "@/components/ui";
import { formatKes, GRACE_DAYS, RENEWAL_PER_IDENTITY_KES } from "@/lib/pricing";
import { daysUntil, type BillingSummary } from "@/lib/identity";
import { cn } from "@/lib/cn";

/**
 * What this account owns and when the next payment falls due.
 *
 * Deliberately excludes usage, branches and team members (§21). The questions
 * it answers are "how many devices are working", "when does the next one need
 * paying for", and "how much will that be" — all three derived from real terms,
 * none of them invented.
 *
 * No plan name, because there are no plans (D-024). The version of this that
 * said "Free" with an alert reading "Your profiles are live and free" described
 * something that stopped being true with D-021: an unactivated profile is a
 * draft now, and saying otherwise on the billing screen would be the worst place
 * to be wrong about it.
 */
export function BillingOverview({ summary }: { summary: BillingSummary }) {
  const none = summary.billable === 0;
  const remaining = daysUntil(summary.renewsOn);
  const renewsOn = summary.renewsOn
    ? new Date(summary.renewsOn).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label uppercase text-muted">
            {none ? "Not active yet" : "Your devices"}
          </p>
          <p className="mt-1 flex items-center gap-2 text-page-title text-foreground">
            {none
              ? "No cards yet"
              : `${summary.billable} ${summary.billable === 1 ? "device" : "devices"}`}
            {!none && !summary.hasLapsed && summary.active > 0 && (
              <Badge variant="success" dot>
                {summary.active} active
              </Badge>
            )}
            {summary.hasLapsed && (
              <Badge variant="danger" dot>
                Needs renewal
              </Badge>
            )}
          </p>
          {!none && (
            <p className="mt-0.5 text-body-sm text-muted">
              {formatKes(RENEWAL_PER_IDENTITY_KES)} per device per year after the first
            </p>
          )}
        </div>

        <Link
          href="/dashboard/checkout"
          className={cn(buttonVariants({ size: "sm", variant: none ? "primary" : "secondary" }))}
        >
          {none ? "Activate" : "Add a device"}
        </Link>
      </div>

      {none && (
        <Alert tone="info" title="Build for nothing, activate to go live">
          Your Tap Profile is a draft until this account has a Smart Card or Smart Stand.
          Activating publishes it at your link, turns on enquiry capture and the full
          report, and the price includes your first twelve months.
        </Alert>
      )}

      {summary.hasLapsed && (
        <Alert tone="danger" title="A device has stopped working">
          Renew below to bring it back. Anyone tapping it right now sees a renewal notice
          instead of your profile.
        </Alert>
      )}

      {!none && !summary.hasLapsed && renewsOn && remaining !== null && remaining <= 30 && (
        <Alert tone="warning" title={`Your next renewal is due ${renewsOn}`}>
          {remaining > 0
            ? `${remaining} day${remaining === 1 ? "" : "s"} left. `
            : "Due now. "}
          Devices keep working for a short grace period after their date.
        </Alert>
      )}

      {!none && !summary.hasLapsed && renewsOn && (remaining === null || remaining > 30) && (
        <div className="flex items-start gap-2 rounded-lg bg-surface-sunken p-3">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-body-sm text-foreground-secondary">
            Everything active. Next renewal{" "}
            <span className="font-medium text-foreground">{renewsOn}</span>.
          </p>
        </div>
      )}

      {/* Facts customers otherwise have to guess at. The third is the one that
          changed with D-018 and it is stated plainly rather than buried: a
          device that lapses stops working, which was NOT true before. Billing
          screens that hide the consequence of not paying are how people get
          surprised, and this one is visible to every account permanently
          rather than as a one-off announcement they may never have read. */}
      <ul className="flex flex-col gap-2 border-t border-border pt-4">
        <Fact>
          <strong className="font-medium text-foreground">Nothing renews automatically.</strong>{" "}
          We hold no standing M-Pesa mandate, so a device simply lapses on its date unless you
          pay again — there is nothing to cancel.
        </Fact>
        <Fact>
          <strong className="font-medium text-foreground">
            An unrenewed device stops working.
          </strong>{" "}
          {GRACE_DAYS} days after its date it stops resolving, and anyone tapping it sees a
          renewal notice instead of your profile. Nothing is deleted — renewing brings it
          straight back, with all your content intact.
        </Fact>
        <Fact>
          <strong className="font-medium text-foreground">No card is stored.</strong> Each
          payment is a one-off M-Pesa prompt sent to the number you enter at the time.
        </Fact>
      </ul>
    </Card>
  );
}

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body-sm text-muted">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}
