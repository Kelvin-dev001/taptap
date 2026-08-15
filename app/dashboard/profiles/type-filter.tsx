"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui";

export const PROFILE_FILTERS = ["all", "business", "card", "redirect"] as const;
export type ProfileFilter = (typeof PROFILE_FILTERS)[number];

export function parseProfileFilter(value: string | undefined): ProfileFilter {
  return (PROFILE_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as ProfileFilter)
    : "all";
}

const LABELS: Record<ProfileFilter, string> = {
  all: "All",
  business: "Pages",
  card: "Cards",
  redirect: "Redirects",
};

/**
 * Smart Business Cards are reached by filtering this list rather than from
 * their own nav destination — see the UI-5 notes. Held in the URL so a filtered
 * view is shareable and survives a refresh, matching the dashboard range tabs.
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
            {LABELS[f]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
