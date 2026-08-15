"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";

/**
 * Dashboard error boundary.
 *
 * Nested inside the shell on purpose: when one screen fails, the sidebar and
 * navigation survive, so an owner can move to a working part of the product
 * instead of being dropped onto a bare page with no way out.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <>
      <PageHeader title="Something went wrong" />
      <Card padding="md" className="flex flex-col items-start gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft">
          <TriangleAlert className="h-5 w-5 text-danger" aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-1">
          <p className="text-card-title text-foreground">This screen couldn&rsquo;t load</p>
          <p className="text-body-sm text-muted">
            Your links, cards and customers are safe — this is a problem showing the page, not
            with your data.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
        </div>

        {error.digest && (
          <p className="text-caption text-muted">
            Reference: <code className="rounded bg-surface-sunken px-1">{error.digest}</code>
          </p>
        )}
      </Card>
    </>
  );
}
