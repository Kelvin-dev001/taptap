"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateSlug } from "@/lib/slug";
import { isSafeDestination } from "@/lib/url";
import { planFor, withinProfileLimit } from "@/lib/plans";

export type CreateState = { error?: string; success?: string };

export async function createProfileAction(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const rawSlug = String(formData.get("slug") ?? "");
  const mode =
    String(formData.get("mode") ?? "redirect") === "page" ? "page" : "redirect";
  const destination = String(formData.get("destination") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;

  const check = validateSlug(rawSlug);
  if (!check.valid) return { error: check.reason };
  if (mode === "redirect" && !isSafeDestination(destination)) {
    return { error: "Enter a valid URL (http, https, tel, or mailto)." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No account found for this user." };

  // Enforce the plan's profile limit server-side.
  const { count } = await supabase
    .from("smart_pages")
    .select("id", { count: "exact", head: true })
    .eq("account_id", profile.account_id);
  const { data: planSub } = await supabase
    .from("subscriptions")
    .select("plan_code")
    .maybeSingle();
  const plan = planFor(planSub?.plan_code);
  if (!withinProfileLimit(plan, count ?? 0)) {
    return {
      error: `Your ${plan.name} plan allows ${plan.limits.maxProfiles} link(s). Upgrade in Billing to add more.`,
    };
  }

  const { data: created, error } = await supabase
    .from("smart_pages")
    .insert({
      account_id: profile.account_id,
      slug: check.slug,
      title,
      mode,
      redirect_url: mode === "redirect" ? destination : null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation (slug already taken)
    if (error.code === "23505") return { error: "That link name is already taken." };
    return { error: error.message };
  }

  revalidatePath("/dashboard");

  // For a smart page, drop the user straight into the editor to build it.
  if (mode === "page" && created) {
    redirect(`/dashboard/${created.id}/edit`);
  }

  return { success: `Created /${check.slug}.` };
}

export async function signOutAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
