import { ImageResponse } from "next/og";
import { createServerSupabase } from "@/lib/supabase/server";
import { CardFront } from "@/components/proof/card-front";
import {
  proofFieldsFromPage,
  PRINT_WIDTH_PX,
  PRINT_HEIGHT_PX,
  type ProofSnapshot,
} from "@/lib/proof";

export const dynamic = "force-dynamic";

/**
 * The Premium front as a 300dpi PNG, for the card printer.
 *
 * 1011 × 638 is CR80 at 300dpi, which is what a dye-sub ID printer wants. Same
 * `CardFront` component as the customer's preview and the print page, rendered
 * through `next/og` exactly as `app/[slug]/opengraph-image.tsx` does — no second
 * renderer, because a second renderer is a second design.
 *
 * READS THE SNAPSHOT, not the live profile. The customer approved a specific
 * card; if they have since renamed their profile or swapped the logo, this must
 * still produce what they approved. Falling back to the live profile is only for
 * a proof that has not been approved yet, which staff should not be printing.
 *
 * Staff-only: it is a picture of somebody's card, and the id is guessable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const { unitId } = await params;
  const supabase = await createServerSupabase();

  // Gated here rather than by a layout: a route handler has none, and this is a
  // picture of somebody's card behind a guessable id. Same shape as the CSV
  // exports in app/api/admin/*.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: staff } = await supabase
    .from("staff")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff) return new Response("Forbidden", { status: 403 });

  const { data: unit } = await supabase
    .from("order_unit_proofs")
    .select("proof_snapshot, proof_page_id, page_title, page_config, page_theme")
    .eq("id", unitId)
    .maybeSingle();

  if (!unit) return new Response("Not found", { status: 404 });

  const snapshot = unit.proof_snapshot as ProofSnapshot | null;
  const fields =
    snapshot ??
    (unit.proof_page_id
      ? proofFieldsFromPage({
          title: unit.page_title,
          config: unit.page_config,
          theme: unit.page_theme,
        })
      : null);

  if (!fields) return new Response("No proof for this card yet", { status: 409 });

  return new ImageResponse(<CardFront fields={fields} />, {
    width: PRINT_WIDTH_PX,
    height: PRINT_HEIGHT_PX,
  });
}
