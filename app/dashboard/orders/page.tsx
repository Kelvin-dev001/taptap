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
  pathForProduct,
  PRODUCT_KIND,
  type OrderPaymentStatus,
  type OrderStatus,
} from "@/lib/orders";
import { cn } from "@/lib/cn";
import { DeliveryDetails } from "./delivery-details";
import { ProofPanel, type ProofUnit, type ProfileOption } from "./proof-panel";
import { proofFieldsFromPage, type ProofSnapshot } from "@/lib/proof";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  number: string;
  product_code: string;
  quantity: number;
  amount_kes: number;
  status: OrderStatus;
  created_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_zone: string | null;
  delivery_town: string | null;
  delivery_area: string | null;
  delivery_notes: string | null;
  dispatch_method: string | null;
  dispatch_reference: string | null;
  dispatched_at: string | null;
  payments: { status: string }[] | null;
};

type PageRow = { id: string; slug: string; title: string | null; status: string | null };

type ProofRow = {
  id: string;
  order_id: string;
  unit_index: number;
  proof_status: string | null;
  proof_page_id: string | null;
  proof_note: string | null;
  proof_snapshot: unknown;
  page_status: string | null;
  page_title: string | null;
  page_config: Record<string, unknown> | null;
  page_theme: Record<string, unknown> | null;
};

/** How the zones are named to a customer. "Upcountry" is a price band, so the
 *  town they gave is preferred wherever there is one. */
const ZONE_LABELS: Record<string, string> = {
  mombasa: "Mombasa",
  nairobi: "Nairobi",
  other: "Upcountry",
};

export default async function OrdersPage() {
  const supabase = await createServerSupabase();

  // RLS scopes all three to the caller's own account (orders_select_own, 0017;
  // order_unit_proofs inherits it through security_invoker, 0029).
  const [{ data, error }, { data: proofData }, { data: pageData }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, number, product_code, quantity, amount_kes, status, created_at, contact_name, contact_phone, delivery_zone, delivery_town, delivery_area, delivery_notes, dispatch_method, dispatch_reference, dispatched_at, payments(status)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("order_unit_proofs")
      .select(
        "id, order_id, unit_index, proof_status, proof_page_id, proof_note, proof_snapshot, page_status, page_title, page_config, page_theme",
      )
      .order("unit_index"),
    supabase.from("smart_pages").select("id, slug, title, status").order("created_at"),
  ]);

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Orders" />
        <MigrationNotice migration="0017_orders.sql" />
      </>
    );
  }

  const orders = (data ?? []) as OrderRow[];

  const profiles: ProfileOption[] = ((pageData ?? []) as PageRow[]).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    published: p.status === "published",
  }));

  // An approved proof renders from its frozen snapshot, never from the live
  // profile: the customer approved a specific card, and a later profile edit
  // must not change what is already being printed (D-029).
  const proofsByOrder = new Map<string, ProofUnit[]>();
  for (const row of (proofData ?? []) as ProofRow[]) {
    const approved = row.proof_status === "approved";
    const snapshot = row.proof_snapshot as ProofSnapshot | null;
    const fields = approved && snapshot
      ? snapshot
      : row.proof_page_id
        ? proofFieldsFromPage({
            title: row.page_title,
            config: row.page_config,
            theme: row.page_theme,
          })
        : null;

    const list = proofsByOrder.get(row.order_id) ?? [];
    list.push({
      id: row.id,
      unit_index: row.unit_index,
      proof_status: row.proof_status,
      proof_page_id: row.proof_page_id,
      proof_note: row.proof_note,
      page_status: row.page_status,
      fields,
      frozen: approved && Boolean(snapshot),
    });
    proofsByOrder.set(row.order_id, list);
  }

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

            const path = pathForProduct(order.product_code);
            const meta = customerFacingStatus(order.status, payment, path);
            const kind: DeviceKind = PRODUCT_KIND[order.product_code] ?? "card";
            const progress = payment === "paid" ? pipelineProgress(order.status, path) : 0;

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

                  {/* The Premium front, when there is one to approve (D-029).
                      Only on a paid order: an unpaid one has no units yet. */}
                  {payment === "paid" && (proofsByOrder.get(order.id)?.length ?? 0) > 0 && (
                    <ProofPanel
                      units={proofsByOrder.get(order.id) ?? []}
                      profiles={profiles}
                    />
                  )}

                  {/* Where it is going, and who has it once it has gone.
                      Only for an order that is actually happening: a failed
                      payment has no parcel, and offering to correct an address
                      for one would imply otherwise. */}
                  {payment === "paid" && order.status !== "cancelled" && (
                    <div className="border-t border-border pt-3">
                      <DeliveryDetails
                        delivery={{
                          orderId: order.id,
                          contactName: order.contact_name,
                          contactPhone: order.contact_phone,
                          town: order.delivery_town,
                          area: order.delivery_area,
                          notes: order.delivery_notes,
                          zoneLabel: ZONE_LABELS[order.delivery_zone ?? ""] ?? null,
                          dispatchMethod: order.dispatch_method,
                          dispatchReference: order.dispatch_reference,
                          dispatchedAt: order.dispatched_at,
                          // The database refuses an edit once it has shipped
                          // (update_order_delivery); this keeps the UI honest
                          // about it rather than offering a form that will fail.
                          editable:
                            order.status !== "dispatched" && order.status !== "delivered",
                        }}
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
