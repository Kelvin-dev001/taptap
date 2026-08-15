"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { isLeadStatus, type LeadStatus } from "@/lib/leads";

export type LeadActionResult = { error?: string };

/**
 * Updates only the owner's own annotations. The submitted contact fields are
 * deliberately not writable — column grants in migration 0012 enforce that at
 * the database, and this action never attempts them either.
 */
export async function updateLeadAction(
  leadId: string,
  patch: { status?: LeadStatus; note?: string | null },
): Promise<LeadActionResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.status !== undefined) {
    if (!isLeadStatus(patch.status)) return { error: "Unknown status." };
    update.status = patch.status;
  }
  if (patch.note !== undefined) {
    const note = (patch.note ?? "").trim();
    if (note.length > 2000) return { error: "Note is too long (2000 characters max)." };
    update.note = note || null;
  }

  // RLS scopes this to leads on the caller's own pages.
  const { error } = await supabase.from("leads").update(update).eq("id", leadId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/customers");
  return {};
}

/**
 * Deletes a submission. `leads_delete_own` has existed since migration 0003 but
 * was never surfaced — and a data-protection request to erase someone's details
 * is a legal obligation under Kenya's DPA, not a convenience.
 */
export async function deleteLeadAction(leadId: string): Promise<LeadActionResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/customers");
  return {};
}
