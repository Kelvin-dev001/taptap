import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type Crumb = { label: string; href: string };

/**
 * Standard page heading: optional breadcrumb, the h1, an optional description
 * and a slot for page-level actions. Every dashboard page uses this so heading
 * levels and spacing stay consistent instead of each page inventing its own.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-caption text-muted">
            {breadcrumbs.map((crumb) => (
              <li key={crumb.href} className="flex items-center gap-1">
                <Link
                  href={crumb.href}
                  className="rounded transition-colors duration-fast hover:text-foreground"
                >
                  {crumb.label}
                </Link>
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title text-foreground">{title}</h1>
          {description && (
            <div className="text-body-sm text-muted">{description}</div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
