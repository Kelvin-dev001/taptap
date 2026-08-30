import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import {
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TableEmpty,
  SortableHeader,
  Pagination,
  buttonVariants,
  type SortDirection,
} from "@/components/ui";
import { formatKes } from "@/lib/pricing";
import {
  ORDER_STATUS_META,
  isOrderStatus,
  isStuck,
  daysAtStage,
  type OrderStatus,
} from "@/lib/orders";
import { OrderFilters } from "./order-filters";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const SORTABLE: Record<string, string> = {
  number: "number",
  business: "business_name",
  amount: "amount_kes",
  updated: "updated_at",
  created: "created_at",
};

export type OrderOverviewRow = {
  id: string;
  number: string;
  business_name: string;
  product_name: string;
  product_kind: string;
  quantity: number;
  amount_kes: number;
  status: OrderStatus;
  contact_name: string | null;
  payment_status: string | null;
  identity_count: number;
  created_at: string;
  updated_at: string | null;
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    paid?: string;
    q?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const status = isOrderStatus(params.status) ? params.status : undefined;
  const paid = params.paid === "paid" || params.paid === "unpaid" ? params.paid : undefined;
  const query = (params.q ?? "").trim();
  const sortKey = SORTABLE[params.sort ?? ""] ? (params.sort as string) : "created";
  const direction: SortDirection = params.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createServerSupabase();

  // Filtering, sorting and paging all happen in the database. Orders accumulate
  // across every customer without limit, so the lead-inbox pattern of loading
  // everything and filtering in the browser would stop working — quietly, and
  // only once there is enough real business to matter.
  let request = supabase
    .from("orders_overview")
    .select("*", { count: "exact" })
    .order(SORTABLE[sortKey], { ascending: direction === "asc" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) request = request.eq("status", status);
  if (paid === "paid") request = request.eq("payment_status", "paid");
  if (paid === "unpaid") request = request.or("payment_status.is.null,payment_status.neq.paid");
  if (query) {
    const safe = query.replace(/[%,()]/g, " ");
    request = request.or(
      `number.ilike.%${safe}%,business_name.ilike.%${safe}%,contact_name.ilike.%${safe}%`,
    );
  }

  const { data, error, count } = await request;

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Orders" />
        <MigrationNotice migration="0018_ops_console.sql" />
      </>
    );
  }

  const orders = (data ?? []) as OrderOverviewRow[];
  const total = count ?? 0;

  const buildHref = (over: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      status: params.status,
      paid: params.paid,
      q: query || undefined,
      sort: params.sort,
      dir: params.dir,
      page: params.page,
      ...over,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"}`}
        actions={
          <a
            href={`/api/admin/orders/csv?${new URLSearchParams({
              ...(status ? { status } : {}),
              ...(paid ? { paid } : {}),
              ...(query ? { q: query } : {}),
            }).toString()}`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Export CSV
          </a>
        }
      />

      <OrderFilters status={params.status} paid={params.paid} q={query} />

      <Table caption="Orders, newest first">
        <TableHead>
          <TableRow>
            <SortableHeader
              label="Order"
              column="number"
              activeColumn={sortKey}
              direction={direction}
              hrefFor={(c, d) => buildHref({ sort: c, dir: d, page: undefined })}
            />
            <SortableHeader
              label="Business"
              column="business"
              activeColumn={sortKey}
              direction={direction}
              hrefFor={(c, d) => buildHref({ sort: c, dir: d, page: undefined })}
            />
            <TableHeader>Product</TableHeader>
            <TableHeader>Stage</TableHeader>
            <TableHeader>Payment</TableHeader>
            <SortableHeader
              label="Amount"
              column="amount"
              activeColumn={sortKey}
              direction={direction}
              hrefFor={(c, d) => buildHref({ sort: c, dir: d, page: undefined })}
            />
            <SortableHeader
              label="Waiting"
              column="updated"
              activeColumn={sortKey}
              direction={direction}
              hrefFor={(c, d) => buildHref({ sort: c, dir: d, page: undefined })}
            />
          </TableRow>
        </TableHead>

        <TableBody>
          {orders.length === 0 ? (
            <TableEmpty colSpan={7}>
              {query || status || paid
                ? "No orders match those filters."
                : "No orders yet."}
            </TableEmpty>
          ) : (
            orders.map((order) => {
              const meta = ORDER_STATUS_META[order.status];
              const stuck = isStuck(order);
              const days = daysAtStage(order.updated_at, order.created_at);

              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-primary-strong hover:underline"
                    >
                      {order.number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate">
                    {order.business_name}
                    {order.contact_name && (
                      <span className="block text-caption text-muted">{order.contact_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {order.quantity} × {order.product_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={meta.tone === "info" ? "brand" : meta.tone}>
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <PaymentCell
                      status={order.payment_status}
                      identityCount={order.identity_count}
                      orderStatus={order.status}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatKes(order.amount_kes)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {stuck ? (
                      <Badge variant="warning" dot>
                        {days}d
                      </Badge>
                    ) : (
                      <span className="text-muted">{days}d</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        hrefFor={(p) => buildHref({ page: p > 1 ? String(p) : undefined })}
        className="mt-4"
      />
    </>
  );
}

/**
 * Payment and provisioning in one column.
 *
 * A paid order with zero identities is the one failure the callback can leave
 * behind — someone has paid for a card that was never created. It is surfaced
 * here rather than assumed away, because nothing else in the system would ever
 * mention it.
 */
function PaymentCell({
  status,
  identityCount,
  orderStatus,
}: {
  status: string | null;
  identityCount: number;
  orderStatus: OrderStatus;
}) {
  if (status === "paid" && identityCount === 0 && orderStatus !== "cancelled") {
    return (
      <Badge variant="danger" dot>
        Paid, no card
      </Badge>
    );
  }
  if (status === "paid") {
    return (
      <Badge variant="success" dot>
        Paid
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="warning" dot>
        Pending
      </Badge>
    );
  }
  return <Badge variant="neutral">Unpaid</Badge>;
}
