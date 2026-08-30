import Link from "next/link";
import { CircleCheck, Info, Headset } from "lucide-react";
import { Card, Badge, Alert, buttonVariants } from "@/components/ui";
import { formatKes, RENEWAL_PER_IDENTITY_KES, type SegmentDefinition } from "@/lib/pricing";
import { daysUntil, type BillingSummary } from "@/lib/identity";
import { cn } from "@/lib/cn";

/**
 * What this account owns and when the next payment falls due.
 *
 * Deliberately excludes usage, branches and team members (§21). The questions
 * it answers are "how many devices are working", "when does the next one need
 * paying for", and "how much will that be" — all three derived from real terms,
 * none of them invented.
 */
export function BillingOverview({
  segment,
  summary,
}: {
  segment: SegmentDefinition;
  summary: BillingSummary;
}) {
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
            {none ? "No devices yet" : "Your plan"}
          </p>
          <p className="mt-1 flex items-center gap-2 text-page-title text-foreground">
            {none ? "Free" : segment.name}
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
              {formatKes(RENEWAL_PER_IDENTITY_KES)} per device per year ·{" "}
              {summary.billable} {summary.billable === 1 ? "device" : "devices"} on this
              account
            </p>
          )}
        </div>

        <Link href="/pricing" className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}>
          {none ? "See pricing" : "Add a device"}
        </Link>
      </div>

      {none && (
        <Alert tone="info" title="Your profiles are live and free">
          Building and sharing a Tap Profile costs nothing. A Smart Card or Smart Stand adds
          the physical tap, enquiry capture and the full analytics report — and the price
          includes the first twelve months.
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

      {segment.salesLed && (
        <div className="flex items-start gap-2 rounded-lg bg-surface-sunken p-3">
          <Headset className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-body-sm text-foreground-secondary">
            You are on a Commercial agreement. For new locations, team access or a quote,{" "}
            <a href="mailto:sales@hornbilltech.co.ke" className="underline">
              talk to us
            </a>
            .
          </p>
        </div>
      )}

      {/* Two facts customers otherwise have to guess at. Both are consequences
          of paying by M-Pesa prompt rather than a stored mandate, and hiding
          them would make an absent Cancel button look like a missing feature. */}
      <ul className="flex flex-col gap-2 border-t border-border pt-4">
        <Fact>
          <strong className="font-medium text-foreground">Nothing renews automatically.</strong>{" "}
          We hold no standing M-Pesa mandate, so a device simply lapses on its date unless you
          pay again — there is nothing to cancel.
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
