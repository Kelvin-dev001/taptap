"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, tokenUrl } from "@/lib/tags";

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

  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return { error: "ADMIN_TOKEN is not configured on the server." };
  if (key !== expected) return { error: "Invalid admin key." };

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const tokens = Array.from({ length: count }, () => generateToken());

  const admin = createAdminClient();
  const { error } = await admin
    .from("nfc_tags")
    .insert(tokens.map((t) => ({ token: t, status: "unassigned" })));
  if (error) return { error: error.message };

  return { urls: tokens.map((t) => tokenUrl(base, t)) };
}
