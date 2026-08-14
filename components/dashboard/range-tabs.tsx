"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { RANGE_OPTIONS, type RangeDays } from "@/lib/metrics";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui";

/**
 * Window selector. The range lives in the URL so a view is shareable and
 * survives refresh, and the server component re-queries with the new window —
 * no client-side data fetching or duplicated state.
 */
export function RangeTabs({ value }: { value: RangeDays }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={String(value)} onValueChange={onChange}>
      <TabsList aria-label="Date range">
        {RANGE_OPTIONS.map((days) => (
          <TabsTrigger key={days} value={String(days)}>
            {days}d
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
