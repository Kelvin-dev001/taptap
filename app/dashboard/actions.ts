"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateSlug } from "@/lib/slug";
import { isSafeDestination } from "@/lib/url";

export type CreateState = { error?: string; success?: string };

export async function createProfileAction(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const rawSlug = String(formData.get("slug") ?? "");
  const destination = String(formData.get("destination") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;

  const check = validateSlug(rawSlug);
  if (!check.valid) return { error: check.reason };
  if (!isSafeDestination(destination)) {
    return { error: "Enter a valid URL (http, https, tel, or mailto)." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No account found for this user." };

  const { error } = await supabase.from("smart_pages").insert({
    account_id: profile.account_id,
    slug: check.slug,
    title,
    mode: "redirect",
    redirect_url: destination,
  });

  if (error) {
    // 23505 = unique_violation (slug already taken)
    if (error.code === "23505") return { error: "That link name is already taken." };
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: `Created your TapTap link: /${check.slug}` };
}

export async function signOutAction() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
