import { useQuery } from "@tanstack/react-query";
import { parseResponse } from "./parse";
import { nullable, object, string } from "./shape";
import { supabase } from "./supabase";

/**
 * The signed-in person's business (PLAN.md §8, `me`). RLS returns only their
 * own profile row and their own account, so the user id is a filter, not a
 * permission.
 */
const MeRow = object({
  account_id: string,
  accounts: nullable(object({ name: string })),
});

export type Me = { accountId: string; businessName: string | null };

export const meQueryKey = (userId: string) => ["me", userId] as const;

export async function fetchMe(userId: string): Promise<Me> {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_id, accounts(name)")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const row = parseResponse(MeRow, data, "profiles.me");
  return { accountId: row.account_id, businessName: row.accounts?.name ?? null };
}

export function useMe(userId: string | null) {
  return useQuery({
    queryKey: meQueryKey(userId ?? ""),
    queryFn: () => fetchMe(userId!),
    enabled: userId !== null,
    staleTime: 5 * 60 * 1000,
  });
}
