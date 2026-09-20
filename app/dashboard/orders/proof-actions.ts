"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { proofFieldsFromPage, proofSnapshot } from "@/lib/proof";

export type ProofResult = { error?: string; success?: string };

/**
 * Choosing which Tap Profile goes on the front of a card (D-029).
 *
 * Ownership, the already-approved rule and the "is this profile even yours"
 * check all live inside `set_unit_proof_page` (migration 0029). `order_units`
 * has no UPDATE policy a customer could act through, so this cannot be done
 * with a plain write, and adding one would expose the binding columns to the
 * row's owner.
 */
export async function setProofPageAction(
  _prev: ProofResult,
  formData: FormData,
): Promise<ProofResult> {
  const unitId = String(formData.get("unitId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  if (!unitId) return { error: "No card given." };
  if (!pageId) return { error: "Choose a profile." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("set_unit_proof_page", {
    p_unit_id: unitId,
    p_page_id: pageId,
  });
  if (error) return { error: humanise(error.message) };

  revalidatePath("/dashboard/orders");
  return { success: "Profile chosen. Check the front and approve it." };
}

/**
 * Approving the front, and freezing exactly what was approved.
 *
 * The snapshot is composed HERE, from the profile as it stands at this moment,
 * and stored by the database. That is what stops a later profile edit changing
 * a card already in production: the print output reads the snapshot, never the
 * live profile, so the customer receives the card they actually saw.
 *
 * It is recomputed server-side rather than accepted from the form. A snapshot
 * posted by the client would be a customer-supplied description of what we are
 * about to print onto plastic.
 */
export async function approveProofAction(
  _prev: ProofResult,
  formData: FormData,
): Promise<ProofResult> {
  const unitId = String(formData.get("unitId") ?? "");
  if (!unitId) return { error: "No card given." };

  const supabase = await createServerSupabase();

  // RLS-scoped through the view: another account's unit reads as missing.
  const { data: unit } = await supabase
    .from("order_unit_proofs")
    .select("id, proof_page_id, page_title, page_config, page_theme, page_status")
    .eq("id", unitId)
    .maybeSingle();

  if (!unit) return { error: "Card not found." };
  if (!unit.proof_page_id) return { error: "Choose which profile goes on this card first." };
  if (unit.page_status !== "published") {
    return {
      error:
        "Publish this profile before approving it. A card that opens an unpublished page arrives dead.",
    };
  }

  const fields = proofFieldsFromPage({
    title: unit.page_title,
    config: unit.page_config,
    theme: unit.page_theme,
  });

  const { error } = await supabase.rpc("approve_unit_proof", {
    p_unit_id: unitId,
    p_snapshot: proofSnapshot(unit.proof_page_id, fields),
  });
  if (error) return { error: humanise(error.message) };

  revalidatePath("/dashboard/orders");
  return { success: "Approved. We will print it exactly as you saw it." };
}

/** Asking for changes. The note is the whole value: without it we would call. */
export async function requestRevisionAction(
  _prev: ProofResult,
  formData: FormData,
): Promise<ProofResult> {
  const unitId = String(formData.get("unitId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!unitId) return { error: "No card given." };
  if (!note) return { error: "Tell us what needs to change." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("request_unit_revision", {
    p_unit_id: unitId,
    p_note: note,
  });
  if (error) return { error: humanise(error.message) };

  revalidatePath("/dashboard/orders");
  return { success: "Thanks. We will make those changes and send it back." };
}

/**
 * The database's exceptions are written for a person and pass through; anything
 * else is an internal failure and must not be shown as though it were advice.
 */
function humanise(message: string): string {
  const known = [
    "card not found",
    "already approved",
    "already gone out",
    "already being made",
    "does not belong",
    "choose which profile",
    "publish this profile",
    "say what needs to change",
    "nothing to approve",
  ];
  const lower = message.toLowerCase();
  if (known.some((k) => lower.includes(k))) {
    return message.charAt(0).toUpperCase() + message.slice(1);
  }
  if (lower.includes("not signed in")) return "Sign in again and retry.";
  return "That did not work. Try again.";
}
