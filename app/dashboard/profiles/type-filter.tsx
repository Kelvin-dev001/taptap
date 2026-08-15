"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui";
import {
  PROFILE_FILTERS,
  PROFILE_FILTER_LABELS,
  type ProfileFilter,
} from "@/lib/profile-filter";

/**
 * Smart Business Cards are reached by filtering this list rather than from
 * their own nav destination — see the UI-5 notes. Held in the URL so a filtered
 * view is shareable and survives a refresh, matching the dashboard range tabs.
 *
 * The vocabulary itself lives in lib/profile-filter.ts because the server page
 * has to call the parser, and a server file cannot call into a client module.
 */
export function TypeFilter({ value }: { value: ProfileFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("type");
    else params.set("type", next);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList aria-label="Filter by type">
        {PROFILE_FILTERS.map((f) => (
          <TabsTrigger key={f} value={f}>
            {PROFILE_FILTER_LABELS[f]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
