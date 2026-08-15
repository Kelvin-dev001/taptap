"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateSlug } from "@/lib/slug";
import { isSafeDestination } from "@/lib/url";
import { planFor, withinProfileLimit } from "@/lib/plans";
import { seedBlocks, type ProfileTemplate, type SeedSource } from "@/lib/templates";
import { defaultLabel } from "@/lib/blocks";
import { isMissingSchemaError } from "@/lib/schema-guard";

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
  const template: ProfileTemplate =
    String(formData.get("template") ?? "business") === "card" ? "card" : "business";

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

  // Business details captured in Settings seed the new profile, so a first
  // page is useful the moment it exists rather than an empty shell (§20).
  // Selecting `profile` fails until migration 0007 is applied — that is not a
  // reason to block creation, so fall back to no seed data.
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("profile")
    .eq("id", profile.account_id)
    .single();
  const seedSource: SeedSource = isMissingSchemaError(accountError)
    ? {}
    : ((account?.profile ?? {}) as SeedSource);

  const { data: created, error } = await supabase
    .from("smart_pages")
    .insert({
      account_id: profile.account_id,
      slug: check.slug,
      title,
      mode,
      redirect_url: mode === "redirect" ? destination : null,
      config: mode === "page" ? { template } : {},
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation (slug already taken)
    if (error.code === "23505") return { error: "That link name is already taken." };
    return { error: error.message };
  }

  if (mode === "page" && created) {
    const seeds = seedBlocks(template, seedSource, defaultLabel);
    if (seeds.length > 0) {
      // A failed seed must not lose the page the owner just created, so this is
      // best-effort: they can still add actions by hand.
      await supabase.from("links").insert(
        seeds.map((b, i) => ({
          smart_page_id: created.id,
          type: b.type,
          label: b.label,
          value: b.value || null,
          sort_order: i,
        })),
      );
    }
  }

  revalidatePath("/dashboard/profiles");
  revalidatePath("/dashboard");

  // For a smart page, drop the user straight into the editor to build it.
  if (mode === "page" && created) {
    redirect(`/dashboard/profiles/${created.id}/edit`);
  }

  return { success: `Created /${check.slug}.` };
}

export type ProfileActionResult = { error?: string };

/**
 * Audit item B12 — carried since UI-0. There was no way to remove a link, so a
 * mistyped slug was permanent and a business closing down could not take its
 * page offline. No migration needed: RLS already limits both to the owner's
 * account, and `links`/`events` cascade or null out by foreign key.
 */
export async function deleteProfileAction(pageId: string): Promise<ProfileActionResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Deleting frees the slug, and any NFC card bound to this page falls back to
  // its unassigned state (nfc_tags.smart_page_id is ON DELETE SET NULL) rather
  // than pointing at nothing.
  const { error } = await supabase.from("smart_pages").delete().eq("id", pageId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/profiles");
  revalidatePath("/dashboard");
  return {};
}

/** Soft on/off switch, independent of publish status. */
export async function setProfileActiveAction(
  pageId: string,
  isActive: boolean,
): Promise<ProfileActionResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("smart_pages")
    .update({ is_active: isActive })
    .eq("id", pageId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/profiles");
  return {};
}
