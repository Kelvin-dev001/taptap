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
} from "@/components/ui";
import {
  QUOTE_STATUS_TONE,
  QUOTE_STATUS_LABELS,
  isOpenQuote,
  type QuoteStatusValue,
} from "@/lib/quotes";
import { QuoteStatus } from "./quote-status";

export const dynamic = "force-dynamic";

export type QuoteRequest = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  quantity: number | null;
  notes: string | null;
  status: QuoteStatusValue;
  created_at: string;
  handled_at: string | null;
};

/**
 * Corporate enquiries waiting on a human.
 *
 * A list rather than a board: a quote has no pipeline worth drawing, it has a
 * person who either has or has not been called back. What matters is that a
 * request cannot quietly sit unanswered, so the newest are first and the status
 * is one control wide.
 *
 * Staff-only through the `/admin` layout, which fails closed (D-020).
 */
export default async function QuotesPage() {
  const supabase = await createServerSupabase();

  // RLS restricts this to staff (quote_requests_select_staff, 0019).
  const { data, error } = await supabase
    .from("quote_requests")
    .select("id, name, company, email, phone, quantity, notes, status, created_at, handled_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (isMissingSchemaError(error)) {
    return (
      <>
        <PageHeader title="Quotes" />
        <MigrationNotice migration="0019_publish_entitlement.sql" />
      </>
    );
  }

  const quotes = (data ?? []) as QuoteRequest[];
  const open = quotes.filter((q) => isOpenQuote(q.status)).length;

  return (
    <>
      <PageHeader
        title="Quotes"
        description={
          open > 0
            ? `${open} still waiting on someone. Newest first.`
            : "Corporate enquiries from the pricing page and the quote form."
        }
      />

      <Table caption="Quote requests, newest first">
        <TableHead>
          <TableRow>
            <TableHeader>Who</TableHeader>
            <TableHeader>Contact</TableHeader>
            <TableHeader>Quantity</TableHeader>
            <TableHeader>Asked</TableHeader>
            <TableHeader>Status</TableHeader>
          </TableRow>
        </TableHead>

        <TableBody>
          {quotes.length === 0 ? (
            <TableEmpty colSpan={5}>
              No quote requests yet. They arrive from the Corporate card on the pricing page.
            </TableEmpty>
          ) : (
            quotes.map((q) => (
              <TableRow key={q.id}>
                <TableCell>
                  <span className="block font-medium text-foreground">{q.name}</span>
                  {q.company && (
                    <span className="block text-caption text-muted">{q.company}</span>
                  )}
                  {q.notes && (
                    <span className="mt-1 block max-w-md text-caption text-foreground-secondary">
                      {q.notes}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {q.email && (
                    <a href={`mailto:${q.email}`} className="block break-all underline">
                      {q.email}
                    </a>
                  )}
                  {q.phone && (
                    <a href={`tel:${q.phone}`} className="block text-caption underline">
                      {q.phone}
                    </a>
                  )}
                  {!q.email && !q.phone && (
                    <span className="text-caption text-muted">Nothing given</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{q.quantity ?? "Not said"}</TableCell>
                <TableCell className="whitespace-nowrap text-caption text-muted">
                  {new Date(q.created_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1.5">
                    <Badge variant={QUOTE_STATUS_TONE[q.status]} dot>
                      {QUOTE_STATUS_LABELS[q.status]}
                    </Badge>
                    <QuoteStatus id={q.id} status={q.status} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
