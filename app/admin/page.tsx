import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { Card, MetricCard, Alert, Badge } from "@/components/ui";
import { isStuck, ORDER_STATUS_META, type OrderStatus } from "@/lib/orders";
import type { OrderOverviewRow } from "./orders/page";

export const dynamic = "force-dynamic";

type OpsOverview = {
  ordersTotal: number;
  ordersUnpaid: number;
  ordersPaidUnprovisioned: number;
  identitiesActive: number;
  identitiesExpiring30: number;
  identitiesLapsed: number;
  tagsUnclaimedPool: number;
  paidWithoutIdentities: {
    accountId: string;
    name: string;
    planCode: string | null;
    periodEnd: string | null;
  }[];
};

export default async function OpsOverviewPage() {
  const supabase = await createServerSupabase();

  const [{ data: overviewData, error }, { data: openData }] = await Promise.all([
    supabase.rpc("ops_overview"),
    // Stuck and stage counts are computed here rather than in SQL, from the
    // bounded set of open orders, so `isStuck` stays the single tested
    // definition instead of being restated in the database and drifting.
    supabase
      .from("orders_overview")
      .select("*")
      .not("status", "in", '("delivered","cancelled")'),
  ]);

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Operations" />
        <MigrationNotice migration="0018_ops_console.sql" />
      </>
    );
  }

  const overview = (overviewData ?? null) as OpsOverview | null;
  const open = (openData ?? []) as OrderOverviewRow[];
  const stuck = open.filter((o) => isStuck(o));

  const byStage = new Map<OrderStatus, number>();
  for (const order of open) {
    byStage.set(order.status, (byStage.get(order.status) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Operations"
        description="What needs attention today."
      />

      {/* The two genuine alarms come first, and only when real. A dashboard
          whose warnings are always present teaches people to ignore them. */}
      {(overview?.ordersPaidUnprovisioned ?? 0) > 0 && (
        <Alert tone="danger" title="Paid orders with no card" className="mb-4">
          {overview?.ordersPaidUnprovisioned} order
          {overview?.ordersPaidUnprovisioned === 1 ? " has" : "s have"} been paid for without
          provisioning an identity. Someone has paid for a card that does not exist.{" "}
          <Link href="/admin/orders?paid=paid" className="underline">
            Find them
          </Link>
          .
        </Alert>
      )}

      {stuck.length > 0 && (
        <Alert tone="warning" title={`${stuck.length} order${stuck.length === 1 ? "" : "s"} stuck`} className="mb-4">
          Sitting on our bench for five days or more.{" "}
          <Link href="/admin/board" className="underline">
            Open the board
          </Link>
          .
        </Alert>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open orders" value={open.length.toLocaleString()} />
        <MetricCard
          label="Unpaid orders"
          value={(overview?.ordersUnpaid ?? 0).toLocaleString()}
          hint="Created but never paid for"
        />
        <MetricCard
          label="Active identities"
          value={(overview?.identitiesActive ?? 0).toLocaleString()}
        />
        <MetricCard
          label="Blank cards in pool"
          value={(overview?.tagsUnclaimedPool ?? 0).toLocaleString()}
          hint="Drawn automatically when an order is paid"
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Renewals due in 30 days"
          value={(overview?.identitiesExpiring30 ?? 0).toLocaleString()}
          hint="Reminder emails go out automatically"
        />
        <MetricCard
          label="Lapsed identities"
          value={(overview?.identitiesLapsed ?? 0).toLocaleString()}
          hint="Past grace — these cards have stopped working"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="md">
          <h2 className="mb-3 text-section-title text-foreground">Work in progress</h2>
          {open.length === 0 ? (
            <p className="text-body-sm text-muted">Nothing in production.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {[...byStage.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/orders?status=${status}`}
                      className="text-body-sm text-foreground hover:text-primary-strong"
                    >
                      {ORDER_STATUS_META[status].label}
                    </Link>
                    <span className="text-body-sm font-medium text-foreground">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        {/* The D-018 leftover, surfaced where it can actually be worked off. */}
        <Card padding="md">
          <h2 className="mb-1 text-section-title text-foreground">Needs reconciling</h2>
          <p className="mb-3 text-body-sm text-muted">
            Accounts on a legacy paid plan that hold no devices, so the per-identity
            migration gave them nothing. Each needs a decision.
          </p>
          {(overview?.paidWithoutIdentities ?? []).length === 0 ? (
            <p className="text-body-sm text-muted">Nothing outstanding.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {overview?.paidWithoutIdentities.map((account) => (
                <li
                  key={account.accountId}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 truncate text-body-sm text-foreground">
                    {account.name}
                  </span>
                  <Badge variant="warning">{account.planCode ?? "paid"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
