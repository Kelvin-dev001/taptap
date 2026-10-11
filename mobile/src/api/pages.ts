import { useQuery } from "@tanstack/react-query";
import type { PageConfig, Theme } from "@taptap/core/profile";
import { parseResponse } from "./parse";
import { array, boolean, nullable, number, object, record, string } from "./shape";
import { supabase } from "./supabase";

/**
 * The account's profiles with their actions (PLAN.md §8, `pages`). RLS returns
 * only this account's rows; an account holds at most 25.
 *
 * One query for Home and the editor: the actions come embedded, so opening the
 * editor needs no second round trip and works offline from the same cache.
 */
const PageRow = object({
  id: string,
  slug: string,
  title: nullable(string),
  mode: string,
  redirect_url: nullable(string),
  config: nullable(record),
  theme: nullable(record),
  status: string,
  is_active: boolean,
  published_at: nullable(string),
  published_content: nullable(record),
  updated_at: string,
  created_at: string,
  entitlement_grandfathered: nullable(boolean),
  links: nullable(
    array(
      object({
        id: string,
        type: string,
        label: nullable(string),
        value: nullable(string),
        sort_order: number,
        is_active: boolean,
      }),
    ),
  ),
});

/**
 * One action as the app holds it. `type` is a string, not lib/profile's
 * BlockType: an action type added on the website after this app version was
 * built must survive an edit here untouched — dropping it would delete it on the
 * next save. Screens narrow it with isBlockType() and show anything unknown
 * as read-only.
 */
export type AppBlock = {
  id: string;
  type: string;
  label: string;
  value: string;
  isActive: boolean;
};

export type Profile = {
  id: string;
  slug: string;
  title: string | null;
  mode: "page" | "redirect";
  redirectUrl: string | null;
  config: PageConfig;
  theme: Theme;
  status: "draft" | "published";
  /** Switched off on the website; its link shows nothing. */
  isActive: boolean;
  publishedAt: string | null;
  /** What customers see: the snapshot taken at the last publish (0009). */
  publishedContent: Record<string, unknown> | null;
  /** The draft's version, sent back with every save (0030). */
  updatedAt: string;
  createdAt: string;
  grandfathered: boolean;
  /** The draft's actions, in order — inactive ones included. */
  blocks: AppBlock[];
};

const COLUMNS =
  "id, slug, title, mode, redirect_url, config, theme, status, is_active, published_at, " +
  "published_content, updated_at, created_at, entitlement_grandfathered, " +
  "links(id, type, label, value, sort_order, is_active)";

export const pagesQueryKey = (userId: string) => ["pages", userId] as const;

function toProfile(row: ReturnType<typeof PageRow>): Profile {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    mode: row.mode === "page" ? "page" : "redirect",
    redirectUrl: row.redirect_url,
    config: (row.config ?? {}) as PageConfig,
    theme: (row.theme ?? {}) as Theme,
    status: row.status === "published" ? "published" : "draft",
    isActive: row.is_active,
    publishedAt: row.published_at,
    publishedContent: row.published_content,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    grandfathered: row.entitlement_grandfathered === true,
    blocks: [...(row.links ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({
        id: l.id,
        type: l.type,
        label: l.label ?? "",
        value: l.value ?? "",
        isActive: l.is_active,
      })),
  };
}

export async function fetchPages(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("smart_pages")
    .select(COLUMNS)
    .order("created_at", { ascending: true })
    .order("sort_order", { referencedTable: "links", ascending: true });
  if (error) throw error;
  return parseResponse(array(PageRow), data, "smart_pages.list").map(toProfile);
}

export function usePages(userId: string | null) {
  return useQuery({
    queryKey: pagesQueryKey(userId ?? ""),
    queryFn: fetchPages,
    enabled: userId !== null,
    staleTime: 30_000,
  });
}
