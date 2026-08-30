import * as React from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Tabular data.
 *
 * Listed in CLAUDE.md §9 since UI-1 and never built, because every list until
 * now was a customer looking at a handful of their own records — a card list is
 * better for that. Staff scanning hundreds of orders across all customers is the
 * case a card list genuinely cannot serve, which is what finally justifies it.
 *
 * Real `<table>` semantics throughout: a grid of divs looks identical and tells
 * a screen reader nothing about rows, columns or headers (§24). The wrapper
 * scrolls horizontally so a wide table never makes the page scroll sideways.
 */
export function Table({
  className,
  caption,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { caption?: string }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <table className={cn("w-full border-collapse text-left", className)} {...props}>
        {/* Named for assistive tech without taking vertical space from everyone
            else — the visible heading above a table rarely reaches the table. */}
        {caption && <caption className="sr-only">{caption}</caption>}
        {props.children}
      </table>
    </div>
  );
}

export function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface-sunken", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors duration-fast hover:bg-surface-sunken/60", className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-label font-medium uppercase tracking-[0.04em] text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 align-middle text-body-sm text-foreground", className)} {...props} />
  );
}

/** A row spanning the full width, for the empty case. */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-body-sm text-muted">
        {children}
      </td>
    </tr>
  );
}

export type SortDirection = "asc" | "desc";

/**
 * A sortable column header.
 *
 * `aria-sort` on the `<th>` is what actually communicates the state; the arrow
 * is decoration. The control is a link rather than a button because sorting
 * lives in the URL — which makes a sorted view shareable, survives a refresh,
 * and works before hydration.
 */
export function SortableHeader({
  label,
  column,
  activeColumn,
  direction,
  hrefFor,
  className,
}: {
  label: string;
  column: string;
  activeColumn?: string | null;
  direction?: SortDirection;
  /** Builds the URL for the next sort state of this column. */
  hrefFor: (column: string, direction: SortDirection) => string;
  className?: string;
}) {
  const active = activeColumn === column;
  const nextDirection: SortDirection = active && direction === "asc" ? "desc" : "asc";
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHeader
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <Link
        href={hrefFor(column, nextDirection)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="h-3 w-3" aria-hidden="true" />
      </Link>
    </TableHeader>
  );
}
