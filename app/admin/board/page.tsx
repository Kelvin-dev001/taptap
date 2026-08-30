import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { Badge } from "@/components/ui";
import { formatKes } from "@/lib/pricing";
import {
  FULFILMENT_PIPELINE,
  ORDER_STATUS_META,
  isStuck,
  daysAtStage,
  type OrderStatus,
} from "@/lib/orders";
import { AdvanceOrder } from "@/components/ops/advance-order";
import type { OrderOverviewRow } from "../orders/page";

export const dynamic = "force-dynamic";

/**
 * The production board.
 *
 * Columns for the stages work actually sits in — `delivered` and `cancelled` are
 * excluded because a board is for what is in flight, and two ever-growing
 * columns of finished work would crowd out everything that needs attention.
 * Both remain visible on the Orders table.
 *
 * Cards move by a button listing the legal next stages, not by dragging.
 * Transitions are constrained, so most drops would have to be refused — and an
 * interaction whose answer is usually "no" is a bad one. This also means the
 * board works identically with a keyboard (§24).
 */
const COLUMNS: OrderStatus[] = FULFILMENT_PIPELINE.filter(
  (s) => s !== "delivered",
).flatMap((s) =>
  // Revision sits immediately after the stage it rejects, not bolted on the
  // end — a column for rejected work parked past "dispatched" reads as a later
  // step rather than a loop back to design.
  s === "awaiting_approval" ? [s, "revision_requested" as OrderStatus] : [s],
);

export default async function BoardPage() {
  const supabase = await createServerSupabase();

  // Open orders only, and unpaginated on purpose: a fulfilment pipeline that
  // holds hundreds of open jobs is a staffing problem, not a paging one.
  const { data, error } = await supabase
    .from("orders_overview")
    .select("*")
    .in("status", COLUMNS)
    .order("created_at", { ascending: true });

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Board" />
        <MigrationNotice migration="0018_ops_console.sql" />
      </>
    );
  }

  const orders = (data ?? []) as OrderOverviewRow[];
  const byStatus = new Map<OrderStatus, OrderOverviewRow[]>();
  for (const order of orders) {
    const list = byStatus.get(order.status) ?? [];
    list.push(order);
    byStatus.set(order.status, list);
  }

  const stuckCount = orders.filter((o) => isStuck(o)).length;

  return (
    <>
      <PageHeader
        title="Board"
        description={
          orders.length === 0
            ? "Nothing in production"
            : `${orders.length} open · ${stuckCount} needing attention`
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((status) => {
          const column = byStatus.get(status) ?? [];
          const meta = ORDER_STATUS_META[status];

          return (
            <section
              key={status}
              aria-label={`${meta.label} — ${column.length} order${column.length === 1 ? "" : "s"}`}
              className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-surface-sunken p-3"
            >
              <header className="flex items-center justify-between gap-2">
                <h2 className="text-label uppercase tracking-[0.04em] text-muted">
                  {meta.label}
                </h2>
                <span className="text-caption text-muted">{column.length}</span>
              </header>

              {column.length === 0 ? (
                <p className="px-1 py-4 text-caption text-muted">Empty</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {column.map((order) => {
                    const stuck = isStuck(order);
                    const days = daysAtStage(order.updated_at, order.created_at);
                    return (
                      <li
                        key={order.id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-body-sm font-medium text-primary-strong hover:underline"
                          >
                            {order.number}
                          </Link>
                          {stuck && (
                            <Badge variant="warning" dot>
                              {days}d
                            </Badge>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-body-sm text-foreground">
                            {order.business_name}
                          </p>
                          <p className="text-caption text-muted">
                            {order.quantity} × {order.product_name} ·{" "}
                            {formatKes(order.amount_kes)}
                          </p>
                        </div>

                        {order.payment_status !== "paid" && (
                          <Badge variant="neutral">Not paid</Badge>
                        )}

                        <AdvanceOrder
                          orderId={order.id}
                          status={order.status}
                          isPaid={order.payment_status === "paid"}
                          compact
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
