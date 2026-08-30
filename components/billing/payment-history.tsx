import Link from "next/link";
import { Receipt, ExternalLink } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatKes } from "@/lib/pricing";
import {
  PAYMENT_STATUS_META,
  isPaymentStatus,
  mpesaReceiptNumber,
  describePayment,
  type PaymentRow,
} from "@/lib/payments";

/**
 * Billing history from the `payments` table — one row per initiated checkout.
 *
 * Pending rows are shown rather than hidden: a payment that never completed is
 * exactly what an owner is looking for when they think they have paid, and
 * quietly dropping it turns a self-service check into a support message.
 */
export function PaymentHistory({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) {
    return (
      <Card padding="md">
        <h2 className="mb-4 text-section-title text-foreground">Billing history</h2>
        <EmptyState
          icon={Receipt}
          title="No payments yet"
          description="Once you buy or renew a device, every payment and its receipt appears here."
        />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h2 className="mb-4 text-section-title text-foreground">Billing history</h2>
      <ul className="flex flex-col divide-y divide-border">
        {payments.map((p) => {
          const status = isPaymentStatus(p.status) ? p.status : "pending";
          const meta = PAYMENT_STATUS_META[status];
          const receipt = mpesaReceiptNumber(p.raw);
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-col">
                <span className="text-body-sm font-medium text-foreground">
                  {describePayment(p)} · {formatKes(p.amount)}
                </span>
                <span className="text-caption text-muted">
                  {new Date(p.created_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {" · "}
                  {receipt ? `M-Pesa ${receipt}` : p.provider.toUpperCase()}
                </span>
                <span className="text-caption text-muted">{meta.description}</span>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Badge variant={meta.tone} dot>
                  {meta.label}
                </Badge>
                {status === "paid" && (
                  <Link
                    href={`/print/receipt?id=${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-caption text-primary-strong hover:underline"
                  >
                    Receipt
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
