"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { isProductionSiteUrl, chipUrlFor, parseScan } from "@/lib/stock";

export type EncodeResult = { error?: string; success?: string; serial?: string };

/**
 * Record that a chip was written, verified and locked.
 *
 * The write itself happens in the browser through Web NFC — this is the half
 * that has to still be true tomorrow. Every refusal that matters lives inside
 * `encode_card` (migration 0027), which holds the row FOR UPDATE and checks the
 * card is actually `received`: two staff working the same batch from two phones
 * is the ordinary case here, not the exotic one.
 *
 * THE SITE-URL GUARD IS RE-CHECKED HERE, not just in the page. A chip encoded
 * from localhost or a preview deployment is a permanently dead card that looks
 * fine until a customer taps it, and the lock means there is no fixing it. The
 * client decides whether to offer the button; this decides whether the write is
 * allowed to be recorded, and a client that has been tampered with or served
 * from the wrong origin gets refused here.
 */
export async function encodeCardAction(
  _prev: EncodeResult,
  formData: FormData,
): Promise<EncodeResult> {
  await requireStaff();

  const tagId = String(formData.get("tagId") ?? "");
  const readBack = String(formData.get("readBack") ?? "").trim();
  // "false" only from the page's test mode, which writes and verifies without
  // locking so a card can be reused while staff learn the flow.
  const locked = String(formData.get("locked") ?? "true") !== "false";

  if (!tagId) return { error: "No card given." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!isProductionSiteUrl(siteUrl)) {
    return {
      error:
        "Encoding is disabled on this deployment. A chip encoded from anywhere but the live site is locked to the wrong URL forever.",
    };
  }

  const supabase = await createServerSupabase();

  // The token is read from the database rather than accepted from the form. The
  // form could name any card; what gets burned onto the chip has to be the token
  // of the row we are about to mark encoded, or the record and the plastic
  // disagree permanently.
  const { data: card } = await supabase
    .from("nfc_tags")
    .select("id, token, serial, stock_state")
    .eq("id", tagId)
    .maybeSingle();
  if (!card) return { error: "Card not found." };

  // What the chip should now contain, recomputed server-side. If the browser
  // read back something else, the write did not land and locking it would
  // preserve the fault rather than catch it.
  const expected = chipUrlFor(siteUrl as string, card.token);
  if (readBack && readBack !== expected) {
    return {
      error: `The chip read back as "${readBack}" but should carry "${expected}". Do not lock it. Retry, or mark it defective.`,
    };
  }

  const { error } = await supabase.rpc("encode_card", {
    p_tag_id: tagId,
    p_locked: locked,
  });
  if (error) return { error: humanise(error.message) };

  revalidatePath("/admin/encode");
  revalidatePath("/admin/stock");

  return {
    success: locked
      ? `${card.serial ?? "Card"} encoded and locked.`
      : `${card.serial ?? "Card"} encoded, NOT locked (test mode).`,
    serial: card.serial ?? undefined,
  };
}


/**
 * Find the card someone is physically holding.
 *
 * A scan can arrive as a URL from the camera reading the printed QR, or as a
 * serial typed by hand when the camera will not focus; `parseScan` decides
 * which. Stock cards belong to nobody, so they are invisible to an
 * account-scoped read — the staff SELECT policy from 0021 is what makes this
 * lookup possible at all, and a non-staff caller finds nothing even before
 * `requireStaff` turns them away.
 */
export async function lookupCardAction(scanned: string): Promise<EncodableCard | null> {
  await requireStaff();

  const parsed = parseScan(scanned);
  if (parsed.kind === "unknown") return null;

  const supabase = await createServerSupabase();
  const query = supabase
    .from("nfc_tags")
    .select("id, serial, token, variant, stock_state, is_placeholder, kind");

  const { data } = await (parsed.kind === "token"
    ? query.eq("token", parsed.token)
    : query.eq("serial", parsed.serial)
  ).maybeSingle();

  return (data as EncodableCard | null) ?? null;
}

/** What the encoder needs to know about a card before writing it. */
export type EncodableCard = {
  id: string;
  serial: string | null;
  token: string;
  variant: string | null;
  stock_state: string | null;
  is_placeholder: boolean | null;
  kind: string | null;
};

/**
 * Postgres exceptions arrive as raw strings. The ones `encode_card` raises are
 * already written for a person and pass through; anything else is an internal
 * failure and must not be shown as though it were advice.
 */
function humanise(message: string): string {
  const known = [
    "card not found",
    "placeholder",
    "stand",
    "defective",
    "already on an order",
    "can only be encoded when received",
  ];
  const lower = message.toLowerCase();
  if (known.some((k) => lower.includes(k))) {
    return message.charAt(0).toUpperCase() + message.slice(1);
  }
  if (lower.includes("staff only")) return "Staff only.";
  return "That did not work. Try again, or write the card off in Stock.";
}
