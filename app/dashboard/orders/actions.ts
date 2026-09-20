"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export type DeliveryResult = { error?: string; success?: string };

/**
 * The customer correcting where their parcel goes.
 *
 * Every rule lives inside `update_order_delivery` (0023) rather than here:
 * ownership, and the one that matters, which is that it stops being editable the
 * moment the parcel leaves. `orders` has a column grant for the delivery fields
 * but no UPDATE policy a customer can act through, so this cannot be done with a
 * plain write, and loosening the policy to allow it would expose `status` to the
 * row's owner as well. One function, one rule, checked where it cannot be
 * skipped.
 *
 * The zone is deliberately not editable. It set the price and the price was
 * charged; moving from Nairobi to upcountry after paying is a refund
 * conversation, not a text field.
 */
export async function updateDeliveryAction(
  _prev: DeliveryResult,
  formData: FormData,
): Promise<DeliveryResult> {
  const orderId = String(formData.get("orderId") ?? "");
  const name = String(formData.get("contactName") ?? "").trim();
  const phone = String(formData.get("contactPhone") ?? "").trim();
  const town = String(formData.get("deliveryTown") ?? "").trim();
  const area = String(formData.get("deliveryArea") ?? "").trim();
  const notes = String(formData.get("deliveryNotes") ?? "").trim();

  if (!orderId) return { error: "No order given." };
  if (!name) return { error: "Who should the rider ask for?" };
  if (!phone) return { error: "A phone number is how the rider finds you." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("update_order_delivery", {
    p_order_id: orderId,
    p_contact_name: name,
    p_contact_phone: phone,
    p_delivery_town: town,
    p_delivery_area: area,
    p_delivery_notes: notes,
  });

  if (error) {
    // The function raises this with a hint written for a person; anything else
    // is an internal failure and should not be shown as though it were advice.
    if (error.message.includes("already_dispatched")) {
      return {
        error: "This order has already gone out. Call us if the address is wrong.",
      };
    }
    return { error: "Could not save that. Try again." };
  }

  revalidatePath("/dashboard/orders");
  return { success: "Delivery details saved." };
}
