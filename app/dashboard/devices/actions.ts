"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function rebindTagAction(formData: FormData) {
  const tagId = String(formData.get("tagId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile) return;

  // Verify the target page belongs to the caller before rebinding.
  const { data: page } = await supabase
    .from("smart_pages")
    .select("id")
    .eq("id", pageId)
    .eq("account_id", profile.account_id)
    .maybeSingle();
  if (!page) return;

  // RLS also restricts the update to the caller's own tags.
  await supabase
    .from("nfc_tags")
    .update({ smart_page_id: pageId, status: "assigned" })
    .eq("id", tagId);

  revalidatePath("/dashboard/devices");
}

export async function setTagStatusAction(formData: FormData) {
  const tagId = String(formData.get("tagId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "assigned" && status !== "disabled") return;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("nfc_tags").update({ status }).eq("id", tagId);
  revalidatePath("/dashboard/devices");
}
