"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSafeDestination } from "@/lib/url";
import { buildHref } from "@/lib/blocks";
import { planFor } from "@/lib/plans";
import type { Block, PageConfig, Theme } from "@/lib/profile";

export type SavePayload = {
  title: string;
  mode: "page" | "redirect";
  redirectUrl: string;
  config: PageConfig;
  theme: Theme;
  blocks: Block[];
};

export type SaveResult = { error?: string; success?: string };

export async function savePageAction(
  pageId: string,
  payload: SavePayload,
): Promise<SaveResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: existing } = await supabase
    .from("smart_pages")
    .select("id, slug")
    .eq("id", pageId)
    .single();
  if (!existing) return { error: "Page not found." };

  if (payload.mode === "redirect" && !isSafeDestination(payload.redirectUrl)) {
    return { error: "Enter a valid redirect URL (http, https, tel, or mailto)." };
  }

  const cleanBlocks = (payload.blocks ?? []).filter((b) =>
    b.type === "contact" ? true : !!buildHref(b.type, b.value),
  );

  // Gate lead capture by plan — silently off if the plan doesn't include it.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_code")
    .maybeSingle();
  const plan = planFor(sub?.plan_code);
  const config = payload.config ?? {};
  if (config.leadForm?.enabled && !plan.limits.leadCapture) {
    config.leadForm = { ...config.leadForm, enabled: false };
  }

  const { error: upErr } = await supabase
    .from("smart_pages")
    .update({
      title: payload.title?.trim() || null,
      mode: payload.mode,
      redirect_url:
        payload.mode === "redirect" ? payload.redirectUrl.trim() : null,
      config,
      theme: payload.theme ?? {},
    })
    .eq("id", pageId);
  if (upErr) return { error: upErr.message };

  // Replace links wholesale (small counts; keeps ordering trivial).
  const { error: delErr } = await supabase
    .from("links")
    .delete()
    .eq("smart_page_id", pageId);
  if (delErr) return { error: delErr.message };

  if (payload.mode === "page" && cleanBlocks.length > 0) {
    const rows = cleanBlocks.map((b, i) => ({
      smart_page_id: pageId,
      type: b.type,
      label: b.label?.trim() || null,
      value: b.value?.trim() || null,
      sort_order: i,
    }));
    const { error: insErr } = await supabase.from("links").insert(rows);
    if (insErr) return { error: insErr.message };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/${existing.slug}`);
  return { success: "Saved." };
}
