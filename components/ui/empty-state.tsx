import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Empty states should teach the next action, not just report absence — the
 * dashboard's "No links yet." is the pattern this replaces.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
          <Icon className="h-5 w-5 text-primary-strong" />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-card-title text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-body-sm text-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
