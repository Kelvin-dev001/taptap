import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "./button";

/**
 * Page controls for a server-paginated list.
 *
 * Links rather than buttons: paging lives in the URL, so a page is shareable,
 * survives a refresh, and works before hydration. The range readout ("21–40 of
 * 137") is the part staff actually use — it answers "how much is there" and
 * "where am I" in one line, which a bare pair of arrows does not.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  className,
}: {
  /** 1-indexed. */
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, total);

  const hasPrev = current > 1;
  const hasNext = current < pageCount;

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
    >
      <p className="text-caption text-muted" aria-live="polite">
        {total === 0 ? "Nothing to show" : `${first}–${last} of ${total}`}
      </p>

      <div className="flex items-center gap-2">
        <PageLink href={hrefFor(current - 1)} disabled={!hasPrev} label="Previous page">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </PageLink>
        <PageLink href={hrefFor(current + 1)} disabled={!hasNext} label="Next page">
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const classes = cn(buttonVariants({ variant: "secondary", size: "sm" }));

  // A disabled control must not be a link at all. An anchor with aria-disabled
  // is still followable by keyboard and by a screen reader's link list, so it
  // becomes a span that is simply not focusable.
  if (disabled) {
    return (
      <span aria-hidden="true" className={cn(classes, "pointer-events-none opacity-40")}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={classes}>
      {children}
    </Link>
  );
}
