"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/staff";
import { generateToken } from "@/lib/tags";
import { verifyAdminKey, ADMIN_KEY_MESSAGES } from "@/lib/admin-auth";
import { MAX_BATCH_QUANTITY } from "@/lib/stock";

export type StockResult = { error?: string; success?: string; batchCode?: string };

/**
 * Mint a batch of stock cards (D-026).
 *
 * Replaces `/admin/mint`, which produced loose tokens with nothing attached to
 * them. A batch is a print run, and a card that is not part of one cannot be
 * traced when a whole run turns out to have bad chips.
 *
 * `ADMIN_TOKEN` survives here as a SECOND factor, exactly as it did on minting
 * (D-020). The staff gate in the layout is who you are; this is confirmation for
 * the one action in the console that creates permanent public identifiers —
 * tokens that will be printed onto plastic and locked onto chips forever.
 *
 * Cards land in `at_supplier`, not `in_stock`. They do not physically exist yet:
 * this creates the rows the CSV is printed from, and they become sellable only
 * once they have arrived and been encoded.
 */
export async function mintBatchAction(
  _prev: StockResult,
  formData: FormData,
): Promise<StockResult> {
  const staff = await requireStaff();

  const key = String(formData.get("key") ?? "");
  const variant = String(formData.get("variant") ?? "");
  const supplier = String(formData.get("supplier") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const quantity = Math.min(
    MAX_BATCH_QUANTITY,
    Math.max(1, parseInt(String(formData.get("quantity") ?? "0"), 10) || 0),
  );

  if (variant !== "standard" && variant !== "premium") {
    return { error: "Choose Standard or Premium." };
  }

  // Constant-time, rate-limited, and refuses to run on a placeholder secret.
  const check = verifyAdminKey(key, process.env.ADMIN_TOKEN);
  if (!check.ok) return { error: ADMIN_KEY_MESSAGES[check.reason] };

  const admin = createAdminClient();

  // Dated and sequenced rather than random: a batch code is read off a box in a
  // store room and typed into a search field, so it has to be sayable.
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = variant === "premium" ? "P" : "S";
  const { count: existing } = await admin
    .from("card_batches")
    .select("id", { count: "exact", head: true })
    .like("code", `${prefix}-${stamp}-%`);
  const code = `${prefix}-${stamp}-${String((existing ?? 0) + 1).padStart(2, "0")}`;

  const { data: batch, error: batchError } = await admin
    .from("card_batches")
    .insert({
      code,
      variant,
      quantity,
      supplier: supplier || null,
      notes: notes || null,
      created_by: staff.userId,
    })
    .select("id, code")
    .single();

  if (batchError || !batch) {
    return { error: "Could not create the batch. Nothing was minted." };
  }

  // Serials come from the database sequence rather than being computed here, so
  // two people minting at once cannot produce the same one.
  const rows = await Promise.all(
    Array.from({ length: quantity }, async () => {
      const { data: serial } = await admin.rpc("next_card_serial", { p_variant: variant });
      return {
        token: generateToken(),
        status: "unassigned",
        batch_id: batch.id,
        variant,
        stock_state: "at_supplier",
        serial: serial as string,
      };
    }),
  );

  const { error: tagError } = await admin.from("nfc_tags").insert(rows);
  if (tagError) {
    // The batch exists with no cards under it. Left in place deliberately: the
    // count is derived, so an empty batch reads as exactly what it is, and
    // deleting it would also delete whichever rows did land.
    return { error: `Batch ${batch.code} was created but the cards failed: ${tagError.message}` };
  }

  revalidatePath("/admin/stock");
  return {
    success: `Batch ${batch.code} minted: ${quantity} ${variant} ${quantity === 1 ? "card" : "cards"}. Export the CSV for the supplier.`,
    batchCode: batch.code,
  };
}

/**
 * The plastic arrived.
 *
 * Moves a whole batch `at_supplier → received`. Still not sellable: the chips
 * are blank until somebody encodes them, and a card whose chip is blank fails in
 * the customer's hand rather than at our bench.
 */
export async function receiveBatchAction(
  _prev: StockResult,
  formData: FormData,
): Promise<StockResult> {
  await requireStaff();

  const batchId = String(formData.get("batchId") ?? "");
  if (!batchId) return { error: "No batch given." };

  const admin = createAdminClient();

  const { data: batch } = await admin
    .from("card_batches")
    .select("id, code, received_at")
    .eq("id", batchId)
    .single();
  if (!batch) return { error: "Batch not found." };
  if (batch.received_at) return { error: `${batch.code} is already marked received.` };

  await admin
    .from("card_batches")
    .update({ received_at: new Date().toISOString() })
    .eq("id", batchId);

  // Only the ones still at the supplier. A card already encoded, allocated or
  // written off is not walked backwards by a box arriving.
  const { error } = await admin
    .from("nfc_tags")
    .update({ stock_state: "received" })
    .eq("batch_id", batchId)
    .eq("stock_state", "at_supplier");
  if (error) return { error: error.message };

  revalidatePath("/admin/stock");
  return { success: `${batch.code} received. Encode the chips before selling them.` };
}

/**
 * Write a card off.
 *
 * A bad chip, a misprint, a card that came out of the laminator bent. It never
 * reaches a customer, and the reason is recorded because three of these from one
 * batch is a supplier conversation rather than three separate shrugs.
 *
 * Refused once a card is allocated: at that point it belongs to an order, and
 * the way to take it back is to undo the assignment, which returns it to stock
 * and keeps the customer's identity intact.
 */
export async function markDefectiveAction(
  _prev: StockResult,
  formData: FormData,
): Promise<StockResult> {
  await requireStaff();

  const serial = String(formData.get("serial") ?? "").trim().toUpperCase();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!serial) return { error: "Which card?" };
  if (!reason) return { error: "Say what is wrong with it." };

  const admin = createAdminClient();
  const { data: tag } = await admin
    .from("nfc_tags")
    .select("id, serial, stock_state")
    .eq("serial", serial)
    .maybeSingle();

  if (!tag) return { error: `No card with serial ${serial}.` };
  if (tag.stock_state === "allocated") {
    return {
      error: `${serial} is on an order. Undo the assignment on that order first, which puts it back in stock.`,
    };
  }
  if (tag.stock_state === "defective") return { error: `${serial} is already written off.` };

  const { error } = await admin
    .from("nfc_tags")
    .update({ stock_state: "defective", defect_reason: reason })
    .eq("id", tag.id);
  if (error) return { error: error.message };

  revalidatePath("/admin/stock");
  return { success: `${serial} written off.` };
}
