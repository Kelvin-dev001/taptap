"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUnpublishedPageError } from "@/lib/entitlement";

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
  if (error) {
    // 0019 refuses a draft. The form already filters to published pages, so
    // reaching this means the page was unpublished in another tab between the
    // render and the submit — worth a sentence rather than a raw exception.
    if (isUnpublishedPageError(error.message)) {
      return {
        error: "That profile is not live. Publish it, then link this card to it.",
      };
    }
    return { error: error.message };
  }

  redirect("/dashboard/devices");
}
