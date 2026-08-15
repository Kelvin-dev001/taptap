import { Card, Skeleton } from "@/components/ui";

/**
 * Shared loading skeleton for dashboard routes.
 *
 * Every dashboard route is `force-dynamic` and queries Supabase, so without one
 * of these a slow connection shows a blank region — which reads as a frozen app
 * rather than a loading one. Shapes roughly match the real page so the layout
 * does not jump when content lands.
 *
 * Skeletons are `aria-hidden`; the single status region below does the
 * announcing, so a screen reader hears "Loading" once rather than a wall of
 * meaningless boxes.
 */
export function PageSkeleton({
  variant = "list",
  label = "Loading…",
}: {
  variant?: "list" | "metrics" | "form" | "report";
  label?: string;
}) {
  return (
    <div>
      <span role="status" className="sr-only">
        {label}
      </span>

      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      {variant === "metrics" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} padding="sm">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-8 w-16" />
            </Card>
          ))}
        </div>
      )}

      {variant === "report" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} padding="sm">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-8 w-16" />
              </Card>
            ))}
          </div>
          <Card padding="md" className="mt-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-4 h-40 w-full" />
          </Card>
        </>
      )}

      {variant === "list" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex w-full flex-col gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {variant === "form" && (
        <Card padding="md" className="max-w-2xl">
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
