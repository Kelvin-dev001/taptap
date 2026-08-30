"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSafeDestination } from "@/lib/url";
import { mergeNotifyPrefs } from "@/lib/notifications/preferences";

export type BusinessProfile = {
  category?: string;
  location?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  googleReviewUrl?: string;
};

export type SettingsState = { error?: string; success?: string };

function clean(value: FormDataEntryValue | null): string | undefined {
  const s = String(value ?? "").trim();
  return s.length > 0 ? s : undefined;
}

/**
 * Saves business identity to `accounts.name` + `accounts.profile` (migration
 * 0007). Ownership is enforced by RLS (`accounts_update_own`) and the write is
 * further limited to those two columns by column grants — the account id is
 * never taken from the client.
 */
export async function saveBusinessProfileAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = clean(formData.get("name"));
  if (!name) return { error: "Business name is required." };
  if (name.length > 120) return { error: "Business name is too long." };

  const website = clean(formData.get("website"));
  const googleReviewUrl = clean(formData.get("googleReviewUrl"));
  for (const [label, url] of [
    ["Website", website],
    ["Google review link", googleReviewUrl],
  ] as const) {
    if (url && !isSafeDestination(url)) {
      return { error: `${label} must be a valid http(s) URL.` };
    }
  }

  // Written wholesale, and that is correct HERE: this form owns every field in
  // BusinessProfile, so a merge would be a no-op plus a query. It stops being
  // correct the moment anything else writes into `profile` — which is exactly
  // what happened to `notify`, and why saveNotificationsAction now merges.
  const profile: BusinessProfile = {
    category: clean(formData.get("category")),
    location: clean(formData.get("location")),
    phone: clean(formData.get("phone")),
    whatsapp: clean(formData.get("whatsapp")),
    website,
    googleReviewUrl,
  };

  const { data: me } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!me) return { error: "No account found for this user." };

  const { error } = await supabase
    .from("accounts")
    .update({ name, profile })
    .eq("id", me.account_id);

  if (error) return { error: error.message };

  // The shell renders the business name on every dashboard route.
  revalidatePath("/dashboard", "layout");
  return { success: "Business details saved." };
}

/**
 * Saves notification preferences.
 *
 * Writes only `accounts.notify`, which the column grant in 0014 permits. The
 * account id comes from the caller's own profile row, never from the client.
 */
export async function saveNotificationsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const enabled = formData.get("leadEmailEnabled") === "on";
  const to = clean(formData.get("leadEmailTo"));

  // A typo here means the alerts stop arriving and nothing says so, which is
  // indistinguishable from the feature being broken. Cheap check, real payoff.
  if (to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { error: "Enter a valid email address, or leave it blank." };
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!me) return { error: "No account found for this user." };

  // Read-modify-write, not replace. This form owns the `lead` section and
  // nothing else, so every other key in `notify` has to survive it — see
  // mergeNotifyPrefs for why that matters more than it currently looks.
  //
  // The read and the write are not atomic. Two people saving Settings in the
  // same instant could lose one of the changes, which is accepted here: it is
  // one owner editing their own preferences, the window is milliseconds, and
  // the alternative — a jsonb-merge RPC — is a migration and a function for a
  // race nobody has. Worth revisiting if team management (D-017) ever puts
  // several people in one account's Settings.
  const { data: current } = await supabase
    .from("accounts")
    .select("notify")
    .eq("id", me.account_id)
    .single();

  const notify = mergeNotifyPrefs(current?.notify, {
    lead: { enabled, to: to ?? null },
  });

  const { error } = await supabase
    .from("accounts")
    .update({ notify })
    .eq("id", me.account_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return {
    success: enabled
      ? `Lead alerts on. Sending to ${to ?? user.email}.`
      : "Lead alerts off.",
  };
}
