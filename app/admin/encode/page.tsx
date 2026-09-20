import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { MigrationNotice } from "@/components/shell/migration-notice";
import { isMissingSchemaError } from "@/lib/schema-guard";
import { Card, Badge, Alert, EmptyState, buttonVariants } from "@/components/ui";
import { isProductionSiteUrl, PRODUCTION_HOST } from "@/lib/stock";
import { cn } from "@/lib/cn";
import { Encoder } from "./encoder";
import { Nfc } from "lucide-react";

export const dynamic = "force-dynamic";

/** One row of `encode_overview()` (migration 0027). */
type BatchRow = {
  id: string;
  code: string;
  variant: string;
  quantity: number;
  remaining: number;
  encoded: number;
  defective: number;
  /** Encoded but not locked: written in test mode, still rewritable. */
  unlocked: number;
};

/**
 * Encoding blank chips (Sprint 8b, H).
 *
 * This page is the missing transition in the stock model. 0021 gave cards a
 * `received` state and `stock_state = 'in_stock'`, and nothing in the
 * application could move between them: a card minted through /admin/stock could
 * never become sellable. Encoding is what closes that gap, because a card is
 * only sellable once its chip actually points somewhere.
 *
 * Batch-oriented because the work is: a box arrives, and somebody sits with a
 * phone and works through it. The page is resumable by construction — it holds
 * no progress of its own, it reads what is still `received` — so putting the
 * phone down and coming back tomorrow is the normal case rather than a recovery
 * path.
 */
export default async function EncodePage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const { batch: selectedId } = await searchParams;
  const supabase = await createServerSupabase();

  // One aggregate rather than every tag row: a batch is up to a thousand cards,
  // and counting them in JavaScript would mean shipping all of them to do it.
  const { data: batchData, error } = await supabase.rpc("encode_overview");

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Encode" />
        <MigrationNotice migration="0027_card_encoding.sql" />
      </>
    );
  }

  const batches = (batchData ?? []) as BatchRow[];
  const selected = batches.find((b) => b.id === selectedId) ?? null;

  // The guard is a constant rather than a setting, because the mistake it
  // prevents is permanent: a chip written from localhost or a preview
  // deployment carries that URL for the life of the card, and the lock means
  // there is no fixing it afterwards.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const canEncode = isProductionSiteUrl(siteUrl);

  return (
    <>
      <PageHeader
        title="Encode"
        description="Write, verify and lock the chips in a received batch."
        breadcrumbs={[{ label: "Stock", href: "/admin/stock" }]}
      />

      <div className="flex max-w-2xl flex-col gap-4">
        {!canEncode && (
          <Alert tone="danger" title="Encoding is disabled here">
            This deployment serves <span className="font-mono">{siteUrl || "no site URL"}</span>.
            Chips may only be written from <span className="font-mono">{PRODUCTION_HOST}</span>,
            because a locked chip carries whatever URL it was given for the life of the card.
          </Alert>
        )}

        {batches.length === 0 ? (
          <EmptyState
            icon={Nfc}
            title="No received batches"
            description="Chips can only be encoded once their batch has physically arrived and been marked received. Mint a batch in Stock, then mark it received when the box turns up."
            action={
              <Link href="/admin/stock" className={cn(buttonVariants())}>
                Go to Stock
              </Link>
            }
          />
        ) : (
          <Card padding="md" className="flex flex-col gap-3">
            <h2 className="text-section-title text-foreground">Received batches</h2>
            <ul className="flex flex-col gap-2">
              {batches.map((b) => {
                const { remaining, encoded: done, defective: bad, unlocked } = b;
                const active = b.id === selectedId;
                return (
                  <li key={b.id}>
                    <Link
                      href={`/admin/encode?batch=${b.id}`}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors duration-fast",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        active
                          ? "border-primary-strong bg-primary-soft"
                          : "border-border hover:bg-surface-sunken",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-body-sm font-medium text-foreground">
                          {b.code}
                        </span>
                        <span className="block text-caption text-muted">
                          {done} of {b.quantity} encoded
                          {bad > 0 ? ` · ${bad} written off` : ""}
                          {unlocked > 0 ? ` · ${unlocked} UNLOCKED` : ""}
                        </span>
                      </span>
                      <Badge variant={remaining === 0 ? "success" : "neutral"}>
                        {remaining === 0 ? "Done" : `${remaining} to go`}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {selected && (
          <Encoder
            batchCode={selected.code}
            siteUrl={siteUrl}
            canEncode={canEncode}
          />
        )}
      </div>
    </>
  );
}
