"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type ClaimResult = { error?: string };

export async function claimTagAction(
  _prev: ClaimResult,
  formData: FormData,
): Promise<ClaimResult> {
  const token = String(formData.get("token") ?? "");
  const pageId = String(formData.get("pageId") ?? "");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in." };

  const { error } = await supabase.rpc("claim_tag", {
    p_token: token,
    p_page_id: pageId,
  });
  if (error) return { error: error.message };

  redirect("/dashboard/tags");
}
