import { Card, Skeleton } from "@/components/ui";

/**
 * Dashboard loading state.
 *
 * Every dashboard route is `force-dynamic` and queries Supabase, so on a slow
 * Kenyan mobile connection there was previously a blank pause with nothing on
 * screen — which reads as a frozen app rather than a loading one.
 *
 * The shape roughly matches the real page so the layout does not jump when
 * content lands. Skeletons are `aria-hidden`; the region below carries the
 * announcement.
 */
export default function DashboardLoading() {
  return (
    <div>
      <span role="status" className="sr-only">
        Loading…
      </span>

      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} padding="sm">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-8 w-20" />
            <Skeleton className="mt-3 h-8 w-full" />
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card padding="md" className="lg:col-span-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-44 w-full" />
        </Card>
        <Card padding="md">
          <Skeleton className="h-4 w-32" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
