import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, Printer } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { Card, Badge, Alert, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatKes, DEVICE_LABELS, type DeviceKind } from "@/lib/pricing";
import { identityState, IDENTITY_STATE_META, type IdentityRow } from "@/lib/identity";
import { PAYMENT_STATUS_META, isPaymentStatus } from "@/lib/payments";
import {
  ORDER_STATUS_META,
  pathForProduct,
  availableTransitions,
  DISPATCH_METHOD_META,
  isDispatchMethod,
  type OrderStatus,
  type OrderEvent,
} from "@/lib/orders";
import { AdvanceOrder } from "@/components/ops/advance-order";
import { DispatchOrder } from "@/components/ops/dispatch-order";
import { AssignCards, type AssignableUnit } from "@/components/ops/assign-cards";
import { OrderProofs, type ProofRow } from "@/components/ops/order-proofs";
import { RecordPayment } from "@/components/ops/record-payment";
import { OrderNotes } from "./order-notes";

export const dynamic = "force-dynamic";

/** Zone names as staff say them. Matches /print/packing-slip. */
const ZONE_LABELS: Record<string, string> = {
  mombasa: "Mombasa",
  nairobi: "Nairobi",
  other: "Upcountry",
};

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
  delivery_zone: string | null;
  delivery_town: string | null;
  delivery_area: string | null;
  delivery_notes: string | null;
  delivery_fee_kes: number | null;
  dispatch_method: string | null;
  dispatch_reference: string | null;
  dispatched_at: string | null;
  created_at: string;
  payment_status: string | null;
  identity_count: number;
  product_code: string;
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [{ data, error }, { data: eventsData }, { data: paymentsData }, { data: proofData }] =
    await Promise.all([
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
    // Premium fronts (0029). Empty for every other path, so the card below
    // simply does not render.
    supabase
      .from("order_unit_proofs")
      .select(
        "id, unit_index, proof_status, proof_note, page_slug, page_title, page_status, approved_at",
      )
      .eq("order_id", id)
      .not("proof_status", "is", null)
      .order("unit_index"),
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

  // The physical units, and whichever card has been scanned onto each. Read
  // through the staff SELECT policy on nfc_tags (0021) rather than the service
  // role, so a non-staff caller who reached this page would see nothing.
  const { data: unitData } = await supabase
    .from("order_units")
    .select("id, unit_index, tag_id, bound_at, nfc_tags!order_units_tag_id_fkey(serial, variant, smart_page_id)")
    .eq("order_id", id)
    .order("unit_index");

  type UnitRow = {
    id: string;
    unit_index: number;
    tag_id: string | null;
    bound_at: string | null;
    nfc_tags: { serial: string | null; variant: string | null; smart_page_id: string | null } | null;
  };
  // PostgREST types an embedded relation as an array even when the foreign key
  // guarantees at most one row, so it is normalised here rather than threaded
  // through every reader.
  const units = ((unitData ?? []) as unknown as (Omit<UnitRow, "nfc_tags"> & {
    nfc_tags: UnitRow["nfc_tags"] | UnitRow["nfc_tags"][];
  })[]).map<UnitRow>((u) => ({
    ...u,
    nfc_tags: Array.isArray(u.nfc_tags) ? (u.nfc_tags[0] ?? null) : u.nfc_tags,
  }));

  const assignable: AssignableUnit[] = units.map((u) => ({
    id: u.id,
    unit_index: u.unit_index,
    serial: u.nfc_tags?.serial ?? null,
    variant: u.nfc_tags?.variant ?? null,
    boundAt: u.bound_at,
  }));

  const path = pathForProduct(order.product_code);
  const isStockPath = path === "stock";
  const dispatched = order.status === "dispatched" || order.status === "delivered";

  // A bound card with no profile behind it still ships: the customer links it on
  // the first tap. Worth saying out loud on the order so staff are not surprised
  // by a support call, but never a reason to hold a parcel (D-026).
  const unboundWithoutPage = units.filter(
    (u) => u.tag_id && !u.nfc_tags?.smart_page_id,
  ).length;

  const meta = ORDER_STATUS_META[order.status];

  // The same answer the move buttons get, from the same function. Rendering the
  // dispatch form on any other basis would make it the one surface that can let
  // an unpaid or half-packed order out of the building.
  const canDispatch = availableTransitions(
    path,
    order.status,
    order.payment_status === "paid",
    { total: units.length, bound: units.filter((u) => u.tag_id).length },
  ).includes("dispatched");

  // Where the rider is actually going, in the order they would read it.
  const destination =
    [order.delivery_area, order.delivery_town].filter((v) => v?.trim()).join(", ") || null;

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
              path={pathForProduct(order.product_code)}
              units={{ total: units.length, bound: units.filter((u) => u.tag_id).length }}
            />
          </Card>

          {/* Only while the money is genuinely outstanding. Offering this on a
              paid order is how the same payment gets recorded twice. */}
          {order.payment_status !== "paid" && order.status !== "cancelled" && (
            <Card padding="md">
              <h2 className="mb-1 text-section-title text-foreground">
                Record an offline payment
              </h2>
              <p className="mb-4 text-body-sm text-muted">
                For cash, bank transfers and Paybill payments made by hand. Staff only, and
                the record keeps your name against it.
              </p>
              <RecordPayment
                orderId={order.id}
                orderNumber={order.number}
                amountKes={order.amount_kes}
              />
            </Card>
          )}

          {/* Assign cards.
              Replaces the old "encode these tokens" block, which told staff to
              write a token onto a card. That is no longer what happens: the card
              is already printed, encoded and locked, and what fulfilment does is
              record WHICH card went to this customer (D-026). */}
          {units.length > 0 && (
            <Card padding="md">
              <h2 className="mb-1 text-section-title text-foreground">
                {isStockPath ? "Assign cards" : "Cards in this order"}
              </h2>
              <p className="mb-4 text-body-sm text-muted">
                {dispatched
                  ? "This order has gone out. What is in the parcel can no longer be changed here."
                  : order.payment_status === "paid"
                    ? "Scan each card as you pack it. Every card must be assigned before this can be dispatched."
                    : "Cards can be assigned once the payment clears."}
              </p>

              {order.payment_status === "paid" ? (
                <AssignCards orderId={order.id} units={assignable} locked={dispatched} />
              ) : (
                <p className="text-body-sm text-muted">
                  Waiting on payment. Nothing comes off the shelf for an unpaid order.
                </p>
              )}

              {units.some((u) => u.tag_id) && (
                <Link
                  href={`/print/packing-slip?order=${order.id}`}
                  prefetch={false}
                  target="_blank"
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-3")}
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  Packing slip
                </Link>
              )}

              {unboundWithoutPage > 0 && (
                <Alert tone="warning" className="mt-3">
                  {unboundWithoutPage === 1
                    ? "One card has no profile chosen yet. It will ask the customer to link it on the first tap, so this does not block dispatch."
                    : `${unboundWithoutPage} cards have no profile chosen yet. They will ask the customer to link them on the first tap, so this does not block dispatch.`}
                </Alert>
              )}
            </Card>
          )}

          {/* Dispatch.
              Deliberately a form and not one more button in the row above. The
              rider's number or the waybill is only knowable while somebody is
              standing over the parcel, and `advanceOrderAction` refuses a bare
              move to `dispatched` so this is the only way out of the building. */}
          {canDispatch && (
            <Card padding="md">
              <h2 className="mb-1 text-section-title text-foreground">Dispatch</h2>
              <p className="mb-4 text-body-sm text-muted">
                Record who has the parcel. The customer gets it in the email that says it is
                on its way.
              </p>
              <DispatchOrder
                orderId={order.id}
                orderNumber={order.number}
                destination={destination}
              />
            </Card>
          )}

          {/* The Premium front, per card (D-029). Printing is offered whatever
              the state, because staff sometimes need to look — but an
              unapproved proof says so rather than being quietly hidden. */}
          {((proofData ?? []) as ProofRow[]).length > 0 && (
            <Card padding="md">
              <h2 className="mb-1 text-section-title text-foreground">Card fronts</h2>
              <p className="mb-4 text-body-sm text-muted">
                Generated from the customer&rsquo;s profile and frozen when they approve it. Print
                from the PNG on a dye-sub printer.
              </p>
              <OrderProofs orderId={order.id} units={(proofData ?? []) as ProofRow[]} />
            </Card>
          )}

          <Card padding="md">
            <h2 className="mb-1 text-section-title text-foreground">Identities this order created</h2>
            <p className="mb-4 text-body-sm text-muted">
              Provisioned when the payment cleared. These are what the customer is billed
              for; the plastic they live on is assigned above.
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

          {/* Where it goes, and who has it.
              Staff packing a parcel could previously see the customer's phone
              number and nothing about the address, which is everything they
              actually need at that moment. */}
          <Card padding="md">
            <h2 className="mb-3 text-section-title text-foreground">Delivery</h2>
            <dl className="flex flex-col gap-2 text-body-sm">
              <Row
                label="Where"
                value={destination ?? ZONE_LABELS[order.delivery_zone ?? ""] ?? "—"}
              />
              <Row label="Zone" value={ZONE_LABELS[order.delivery_zone ?? ""] ?? "—"} />
              <Row
                label="Fee"
                value={
                  order.delivery_fee_kes && order.delivery_fee_kes > 0
                    ? formatKes(order.delivery_fee_kes)
                    : "Free"
                }
              />
              {order.delivery_notes && <Row label="Notes" value={order.delivery_notes} />}
              {order.dispatched_at && (
                <>
                  <Row
                    label="Sent"
                    value={`${
                      isDispatchMethod(order.dispatch_method)
                        ? DISPATCH_METHOD_META[order.dispatch_method].label
                        : "Dispatched"
                    } · ${new Date(order.dispatched_at).toLocaleDateString()}`}
                  />
                  <Row label="Reference" value={order.dispatch_reference ?? "—"} />
                </>
              )}
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
