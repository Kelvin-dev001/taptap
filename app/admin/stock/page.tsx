import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { Card, Badge, Alert, buttonVariants } from "@/components/ui";
import {
  STOCK_STATES,
  STOCK_STATE_META,
  LOW_STOCK_THRESHOLD,
  inStockFor,
  lowStockVariants,
  type StockState,
} from "@/lib/stock";
import { cn } from "@/lib/cn";
import { MintBatch } from "./mint-batch";
import { ReceiveBatch, MarkDefective } from "./batch-actions";

export const dynamic = "force-dynamic";

type BatchRow = {
  id: string;
  code: string;
  variant: string;
  quantity: number;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  received_at: string | null;
};

type CountRow = { variant: string; stock_state: string };

/**
 * The shelf (D-026).
 *
 * Replaces `/admin/mint`, which produced loose tokens with nothing attached to
 * them and told staff to "encode the URLs onto NFC cards". That is no longer
 * what happens: a supplier prints cards in bulk from a batch CSV, they arrive,
 * we encode and lock them, and they wait for somebody to buy one.
 */
export default async function StockPage() {
  const supabase = await createServerSupabase();

  const [{ data: batchData, error }, { data: countData }] = await Promise.all([
    supabase
      .from("card_batches")
      .select("id, code, variant, quantity, supplier, notes, created_at, received_at")
      .order("created_at", { ascending: false }),
    supabase.from("nfc_tags").select("variant, stock_state").not("stock_state", "is", null),
  ]);

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Stock" />
        <MigrationNotice migration="0021_stock_inventory.sql" />
      </>
    );
  }

  const batches = (batchData ?? []) as BatchRow[];
  const rows = (countData ?? []) as CountRow[];

  // Counted here rather than in SQL: the whole set is small, and `lib/stock.ts`
  // is where "what counts as in stock" is decided and tested. A second copy of
  // that rule in a view would drift from the first (D-020's reasoning).
  const counts = STOCK_STATES.flatMap((state) =>
    ["standard", "premium"].map((variant) => ({
      variant,
      state,
      count: rows.filter((r) => r.variant === variant && r.stock_state === state).length,
    })),
  ).filter((c) => c.count > 0);

  const low = lowStockVariants(counts);
  const batchCounts = new Map<string, number>();
  for (const b of batches) batchCounts.set(b.id, b.quantity);

  return (
    <>
      <PageHeader
        title="Stock"
        description="Cards are printed in bulk, encoded here, and wait on the shelf until somebody buys one."
      />

      <div className="flex flex-col gap-4">
        {low.length > 0 && (
          <Alert tone="warning" title="Running low">
            {low
              .map(
                (v) =>
                  `${v.variant === "premium" ? "Premium" : "Standard"}: ${v.inStock} on the shelf`,
              )
              .join(". ")}
            . Fewer than {LOW_STOCK_THRESHOLD} means ordering now, because a print run and
            shipping take weeks.
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex flex-col gap-4">
            <Card padding="md">
              <h2 className="mb-1 text-section-title text-foreground">On the shelf</h2>
              <p className="mb-4 text-body-sm text-muted">
                Only encoded cards can fill an order. Received cards still have blank chips.
              </p>

              <dl className="grid grid-cols-2 gap-3">
                {(["standard", "premium"] as const).map((variant) => (
                  <div key={variant} className="rounded-lg border border-border p-3">
                    <dt className="text-caption text-muted">
                      {variant === "premium" ? "Premium" : "Standard"}
                    </dt>
                    <dd className="text-metric text-foreground">{inStockFor(counts, variant)}</dd>
                    <dd className="text-caption text-muted">ready to sell</dd>
                  </div>
                ))}
              </dl>

              {counts.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
                  {counts.map((c) => {
                    const meta = STOCK_STATE_META[c.state as StockState];
                    return (
                      <li
                        key={`${c.variant}-${c.state}`}
                        className="flex items-center justify-between gap-2 text-body-sm"
                      >
                        <span className="flex items-center gap-2 text-muted">
                          <Badge variant={meta.tone === "info" ? "brand" : meta.tone}>
                            {meta.label}
                          </Badge>
                          <span className="capitalize">{c.variant}</span>
                        </span>
                        <span className="font-medium text-foreground">{c.count}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card padding="md">
              <h2 className="mb-1 text-section-title text-foreground">Write a card off</h2>
              <p className="mb-4 text-body-sm text-muted">
                A bad chip, a misprint, a bent card. It never reaches a customer, and the
                reason is recorded because three from one batch is a supplier conversation.
              </p>
              <MarkDefective />
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card padding="md">
              <h2 className="mb-1 text-section-title text-foreground">Mint a batch</h2>
              <p className="mb-4 text-body-sm text-muted">
                Creates the tokens and serials for one print run. Export the CSV and send it
                to the supplier. The cards do not exist yet, so they start at the supplier.
              </p>
              <MintBatch />
            </Card>

            <Card padding="md">
              <h2 className="mb-4 text-section-title text-foreground">Batches</h2>

              {batches.length === 0 ? (
                <p className="text-body-sm text-muted">
                  Nothing minted yet. A batch is a print run: mint one, export the CSV, and
                  send it to the supplier.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {batches.map((batch) => (
                    <li key={batch.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-body-sm font-medium text-foreground">
                            <span className="font-mono">{batch.code}</span>
                            <Badge variant="neutral">{batch.variant}</Badge>
                            {batch.received_at ? (
                              <Badge variant="success">Received</Badge>
                            ) : (
                              <Badge variant="warning">At supplier</Badge>
                            )}
                          </p>
                          <p className="text-caption text-muted">
                            {batchCounts.get(batch.id) ?? batch.quantity} cards
                            {batch.supplier ? ` · ${batch.supplier}` : ""} ·{" "}
                            {new Date(batch.created_at).toLocaleDateString()}
                          </p>
                          {batch.notes && (
                            <p className="mt-0.5 text-caption text-muted">{batch.notes}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            href={`/api/admin/stock/csv?batch=${batch.id}`}
                            prefetch={false}
                            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                          >
                            CSV
                          </Link>
                          {!batch.received_at && <ReceiveBatch batchId={batch.id} />}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
