import Link from "next/link";
import { Package } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, Badge, EmptyState, buttonVariants } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { formatKes, DEVICE_LABELS, type DeviceKind } from "@/lib/pricing";
import {
  customerFacingStatus,
  pipelineProgress,
  PRODUCT_KIND,
  type OrderPaymentStatus,
  type OrderStatus,
} from "@/lib/orders";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  number: string;
  product_code: string;
  quantity: number;
  amount_kes: number;
  status: OrderStatus;
  created_at: string;
  payments: { status: string }[] | null;
};

export default async function OrdersPage() {
  const supabase = await createServerSupabase();

  // RLS scopes this to the caller's own account (orders_select_own, 0017).
  const { data, error } = await supabase
    .from("orders")
    .select("id, number, product_code, quantity, amount_kes, status, created_at, payments(status)")
    .order("created_at", { ascending: false });

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Orders" />
        <MigrationNotice migration="0017_orders.sql" />
      </>
    );
  }

  const orders = (data ?? []) as OrderRow[];

  return (
    <>
      <PageHeader
        title="Orders"
        description="Cards and stands you have ordered, and where they have got to."
        breadcrumbs={[{ label: "Billing", href: "/dashboard/billing" }]}
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Order a Smart Card or Smart Stand and you can follow it from payment to delivery here."
          action={
            <Link href="/dashboard/billing" className={cn(buttonVariants())}>
              Get a device
            </Link>
          }
        />
      ) : (
        <ul className="flex max-w-3xl flex-col gap-3">
          {orders.map((order) => {
            // The most advanced payment wins: a retry after a failure means the
            // order is paid, and showing the earlier failure would be a lie.
            const statuses = (order.payments ?? []).map((p) => p.status);
            const payment: OrderPaymentStatus | null = statuses.includes("paid")
              ? "paid"
              : statuses.includes("pending")
                ? "pending"
                : statuses.includes("failed")
                  ? "failed"
                  : null;

            const meta = customerFacingStatus(order.status, payment);
            const kind: DeviceKind = PRODUCT_KIND[order.product_code] ?? "card";
            const progress = payment === "paid" ? pipelineProgress(order.status) : 0;

            return (
              <li key={order.id}>
                <Card padding="md" className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-card-title text-foreground">
                        {order.quantity} × {DEVICE_LABELS[kind]}
                      </p>
                      <p className="text-caption text-muted">
                        {order.number} ·{" "}
                        {new Date(order.created_at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · {formatKes(order.amount_kes)}
                      </p>
                    </div>
                    <Badge
                      variant={meta.tone === "info" ? "brand" : meta.tone}
                      dot
                    >
                      {meta.customerLabel}
                    </Badge>
                  </div>

                  <p className="text-body-sm text-foreground-secondary">{meta.description}</p>

                  {/* Progress is shown only once the order is actually paid and
                      moving — a bar at zero on an unpaid order reads as a
                      stalled job rather than one that has not started. */}
                  {progress > 0 && (
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
                      role="progressbar"
                      aria-valuenow={Math.round(progress * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Order progress"
                    >
                      <div
                        className="h-full rounded-full bg-primary-strong transition-[width] duration-slow ease-standard"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
