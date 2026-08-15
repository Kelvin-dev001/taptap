/**
 * Profile list filter vocabulary.
 *
 * Lives here rather than beside the `TypeFilter` component because the server
 * page needs to CALL `parseProfileFilter` to read the query string, and a
 * function exported from a `"use client"` module cannot be called from the
 * server — it throws "Attempted to call … from the server but … is on the
 * client" at request time, which no build, type check or test will catch.
 */
export const PROFILE_FILTERS = ["all", "business", "card", "redirect"] as const;
export type ProfileFilter = (typeof PROFILE_FILTERS)[number];

export const PROFILE_FILTER_LABELS: Record<ProfileFilter, string> = {
  all: "All",
  business: "Pages",
  card: "Cards",
  redirect: "Redirects",
};

export function parseProfileFilter(value: string | undefined): ProfileFilter {
  return (PROFILE_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as ProfileFilter)
    : "all";
}
