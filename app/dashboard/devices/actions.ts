"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { isValidToken } from "@/lib/tags";

export type DeviceResult = { error?: string; success?: string };

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

/**
 * Names a card. `nfc_tags.label` has existed since migration 0005 and was never
 * surfaced, so cards could only be told apart by the last six characters of a
 * random token — useless for a business with a card at the till, one at
 * reception and one on each table.
 */
export async function renameTagAction(
  tagId: string,
  label: string,
): Promise<DeviceResult> {
  const trimmed = label.trim();
  if (trimmed.length > 60) return { error: "Name is too long (60 characters max)." };

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("nfc_tags")
    .update({ label: trimmed || null })
    .eq("id", tagId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/devices");
  return { success: "Card renamed." };
}

/**
 * Swaps a lost or damaged card for a new one, moving the binding across and
 * disabling the old card in a single transaction (`replace_tag`, migration
 * 0010). Doing it in two steps from the client would leave a window where a
 * lost card still resolves.
 */
export async function replaceTagAction(
  oldTagId: string,
  newToken: string,
): Promise<DeviceResult> {
  const token = newToken.trim();
  if (!isValidToken(token)) {
    return { error: "That does not look like a Hornbill card code." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("replace_tag", {
    p_old_tag_id: oldTagId,
    p_new_token: token,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/devices");
  return { success: "Replacement card is now live. The old card has been disabled." };
}
