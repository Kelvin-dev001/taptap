"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, tokenUrl } from "@/lib/tags";
import { verifyAdminKey, ADMIN_KEY_MESSAGES } from "@/lib/admin-auth";

export type MintResult = { error?: string; urls?: string[] };

export async function mintTagsAction(
  _prev: MintResult,
  formData: FormData,
): Promise<MintResult> {
  const key = String(formData.get("key") ?? "");
  const count = Math.min(
    500,
    Math.max(1, parseInt(String(formData.get("count") ?? "10"), 10) || 0),
  );

  // Constant-time, rate-limited, and refuses to run on a placeholder secret.
  const check = verifyAdminKey(key, process.env.ADMIN_TOKEN);
  if (!check.ok) return { error: ADMIN_KEY_MESSAGES[check.reason] };

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const tokens = Array.from({ length: count }, () => generateToken());

  const admin = createAdminClient();
  const { error } = await admin
    .from("nfc_tags")
    .insert(tokens.map((t) => ({ token: t, status: "unassigned" })));
  if (error) return { error: error.message };

  return { urls: tokens.map((t) => tokenUrl(base, t)) };
}
