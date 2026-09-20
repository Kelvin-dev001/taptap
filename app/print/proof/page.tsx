import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { createServerSupabase } from "@/lib/supabase/server";
import { Alert } from "@/components/ui";
import { CardFront } from "@/components/proof/card-front";
import {
  proofFieldsFromPage,
  CR80_WIDTH_MM,
  CR80_HEIGHT_MM,
  PRINT_WIDTH_PX,
  PRINT_HEIGHT_PX,
  type ProofSnapshot,
} from "@/lib/proof";
import { PrintButton } from "../qr/print-button";

export const dynamic = "force-dynamic";

/**
 * The Premium front, at exactly CR80, for a card printer.
 *
 * Follows /print/receipt and /print/packing-slip: outside the dashboard shell,
 * search-param driven, rendered on the server, `print:` variants to strip the
 * chrome when it meets a printer. Nav has no business on a page whose only job
 * is to come out of one.
 *
 * The card is rendered at its print pixel size and then scaled to millimetres,
 * so the geometry is identical to the PNG and to what the customer approved.
 * `@page { size: 85.6mm 54mm; margin: 0 }` means the browser sends the card
 * itself rather than a card centred on A4.
 *
 * READS THE SNAPSHOT. The customer approved a specific card, and a profile
 * edited since approval must not change what comes out of the printer.
 */
export default async function ProofPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  await requireStaff();

  const { unit: unitId } = await searchParams;
  if (!unitId) notFound();

  const supabase = await createServerSupabase();
  const { data: unit } = await supabase
    .from("order_unit_proofs")
    .select(
      "id, unit_index, order_number, proof_status, proof_snapshot, proof_page_id, page_title, page_config, page_theme",
    )
    .eq("id", unitId)
    .maybeSingle();

  if (!unit) notFound();

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

  if (!fields) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6 print:p-0">
      <style>{`@page { size: ${CR80_WIDTH_MM}mm ${CR80_HEIGHT_MM}mm; margin: 0 }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-page-title text-foreground">
            {unit.order_number} · card {unit.unit_index}
          </h1>
          <p className="text-body-sm text-muted">
            {snapshot
              ? "The approved version. Later profile edits do not change this."
              : "NOT APPROVED YET. This is the live profile, and the customer has not agreed to it."}
          </p>
        </div>
        <PrintButton />
      </div>

      {!snapshot && (
        <Alert tone="warning" className="print:hidden" title="Not approved">
          Printing this now risks making something the customer did not ask for.
        </Alert>
      )}

      {/* Print pixels scaled into millimetres: identical geometry to the PNG. */}
      <div
        style={{
          width: `${CR80_WIDTH_MM}mm`,
          height: `${CR80_HEIGHT_MM}mm`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: PRINT_WIDTH_PX,
            height: PRINT_HEIGHT_PX,
            transform: `scale(calc(${CR80_WIDTH_MM}mm / ${PRINT_WIDTH_PX}px))`,
            transformOrigin: "top left",
          }}
        >
          <CardFront fields={fields} />
        </div>
      </div>

      <p className="text-caption text-muted print:hidden">
        {CR80_WIDTH_MM} × {CR80_HEIGHT_MM} mm at 300dpi ({PRINT_WIDTH_PX} × {PRINT_HEIGHT_PX} px).
        For a dye-sub printer, use the PNG from the order page rather than the browser.
      </p>
    </main>
  );
}
