import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { Card, Badge } from "@/components/ui";
import { formatKes, DEVICE_LABELS, type DeviceKind } from "@/lib/pricing";
import { identityState, IDENTITY_STATE_META, type IdentityRow } from "@/lib/identity";
import { PAYMENT_STATUS_META, isPaymentStatus } from "@/lib/payments";
import { ORDER_STATUS_META, type OrderStatus, type OrderEvent } from "@/lib/orders";
import { AdvanceOrder } from "@/components/ops/advance-order";
import { OrderNotes } from "./order-notes";

export const dynamic = "force-dynamic";

type Detail = {
  id: string;
  number: string;
  business_name: string;
  account_id: string;
  product_name: string;
  product_kind: string;
  quantity: number;
  amount_kes: number;
  status: OrderStatus;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  payment_status: string | null;
  identity_count: number;
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [{ data, error }, { data: eventsData }, { data: paymentsData }] = await Promise.all([
    supabase.from("orders_overview").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("order_events")
      .select("id, order_id, from_status, to_status, changed_by, note, at")
      .eq("order_id", id)
      .order("at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, reference, amount, status, created_at, payment_tags(tag_id)")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Order" />
        <MigrationNotice migration="0018_ops_console.sql" />
      </>
    );
  }

  const order = (data ?? null) as Detail | null;
  if (!order) notFound();

  const events = (eventsData ?? []) as OrderEvent[];
  const payments = (paymentsData ?? []) as {
    id: string;
    reference: string;
    amount: number;
    status: string;
    created_at: string;
    payment_tags: { tag_id: string }[] | null;
  }[];

  const tagIds = payments.flatMap((p) => (p.payment_tags ?? []).map((t) => t.tag_id));
  const { data: tagData } = tagIds.length
    ? await supabase
        .from("nfc_tags")
        .select("id, token, label, kind, status, account_id, smart_page_id, term_start, term_end")
        .in("id", tagIds)
    : { data: [] };
  const identities = (tagData ?? []) as IdentityRow[];

  const meta = ORDER_STATUS_META[order.status];

  return (
    <>
      <PageHeader
        title={order.number}
        description={`${order.business_name} · ${order.quantity} × ${order.product_name} · ${formatKes(order.amount_kes)}`}
        breadcrumbs={[{ label: "Orders", href: "/admin/orders" }]}
        actions={
          <Badge variant={meta.tone === "info" ? "brand" : meta.tone} dot>
            {meta.label}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card padding="md">
            <h2 className="mb-1 text-section-title text-foreground">Move this order</h2>
            <p className="mb-4 text-body-sm text-muted">{meta.description}.</p>
            <AdvanceOrder
              orderId={order.id}
              status={order.status}
              isPaid={order.payment_status === "paid"}
            />
          </Card>

          <Card padding="md">
            <h2 className="mb-1 text-section-title text-foreground">Cards this order created</h2>
            <p className="mb-4 text-body-sm text-muted">
              Provisioned when the payment cleared. Encode these tokens onto the physical
              cards.
            </p>

            {identities.length === 0 ? (
              <p className="text-body-sm text-muted">
                {order.payment_status === "paid"
                  ? "Paid, but nothing was provisioned. This needs looking at — the customer has paid for a card that does not exist."
                  : "Nothing yet. Cards are created when the payment clears."}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {identities.map((tag) => {
                  const state = identityState(tag);
                  const stateMeta = IDENTITY_STATE_META[state];
                  const kind = (tag.kind as DeviceKind) ?? "card";
                  return (
                    <li
                      key={tag.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
                          <CreditCard className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                          {tag.label || DEVICE_LABELS[kind]}
                        </p>
                        <p className="break-all font-mono text-caption text-muted">
                          {tag.token}
                        </p>
                        <p className="text-caption text-muted">
                          {tag.smart_page_id ? "Pointed at a profile" : "Not claimed yet"}
                          {tag.term_end
                            ? ` · until ${new Date(tag.term_end).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <Badge variant={stateMeta.tone === "neutral" ? "neutral" : stateMeta.tone}>
                        {stateMeta.label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card padding="md">
            <h2 className="mb-4 text-section-title text-foreground">History</h2>
            {/* Written by a database trigger on every status change (0017), so
                this is a record rather than something the console remembered
                to write. */}
            <ol className="flex flex-col gap-3">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-body-sm text-foreground">
                      {event.from_status
                        ? `${ORDER_STATUS_META[event.from_status].label} → ${ORDER_STATUS_META[event.to_status].label}`
                        : `Created as ${ORDER_STATUS_META[event.to_status].label}`}
                    </p>
                    <p className="text-caption text-muted">
                      {new Date(event.at).toLocaleString()}
                      {event.changed_by ? "" : " · system"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card padding="md">
            <h2 className="mb-3 text-section-title text-foreground">Customer</h2>
            <dl className="flex flex-col gap-2 text-body-sm">
              <Row label="Business" value={order.business_name} />
              <Row label="Contact" value={order.contact_name ?? "—"} />
              <Row label="Phone" value={order.contact_phone ?? "—"} />
              <Row label="Ordered" value={new Date(order.created_at).toLocaleDateString()} />
            </dl>
          </Card>

          <Card padding="md">
            <h2 className="mb-3 text-section-title text-foreground">Payments</h2>
            {payments.length === 0 ? (
              <p className="text-body-sm text-muted">No payment recorded.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {payments.map((payment) => {
                  const status = isPaymentStatus(payment.status) ? payment.status : "pending";
                  const pm = PAYMENT_STATUS_META[status];
                  return (
                    <li key={payment.id} className="flex flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2 text-body-sm text-foreground">
                        {formatKes(payment.amount)}
                        <Badge variant={pm.tone} dot>
                          {pm.label}
                        </Badge>
                      </span>
                      <span className="break-all text-caption text-muted">
                        {payment.reference}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <OrderNotes orderId={order.id} notes={order.notes} />
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-foreground">{value}</dd>
    </div>
  );
}
