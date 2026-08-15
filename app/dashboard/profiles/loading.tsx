import { Card, Skeleton } from "@/components/ui";

/** Matches the two-column profiles layout so nothing jumps when content lands. */
export default function ProfilesLoading() {
  return (
    <div>
      <span role="status" className="sr-only">
        Loading your links…
      </span>

      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} padding="sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex w-full flex-col gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0" />
              </div>
              <Skeleton className="mt-3 h-7 w-56" />
            </Card>
          ))}
        </div>

        <Card padding="md">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
