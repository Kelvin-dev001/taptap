import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { createServerSupabase } from "@/lib/supabase/server";
import { PrintButton } from "../qr/print-button";

export const dynamic = "force-dynamic";

type SlipOrder = {
  id: string;
  number: string;
  business_name: string | null;
  product_name: string;
  quantity: number;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_zone: string | null;
  delivery_town: string | null;
  delivery_area: string | null;
  delivery_notes: string | null;
};

const ZONE_LABELS: Record<string, string> = {
  mombasa: "Mombasa",
  nairobi: "Nairobi",
  other: "Upcountry",
};

/**
 * What goes in the parcel.
 *
 * Follows /print/receipt exactly: outside the dashboard shell, search-param
 * driven, rendered entirely on the server, `print:` variants to strip the chrome
 * when it actually meets a printer. Nav has no business on a page whose only job
 * is to come out of one.
 *
 * Staff-gated rather than customer-gated, which is the one place it diverges
 * from the receipt: this lists the serials in the box, and a customer has no use
 * for a picking list.
 *
 * The insert text is the whole of the customer's first-run instructions. It has
 * to work for somebody who has never held an NFC card, on a phone whose reader
 * is in a different place depending on who made it — which is why it names both
 * and then offers the QR for anyone whose phone has no reader at all.
 */
export default async function PackingSlipPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  await requireStaff();

  const { order: orderId } = await searchParams;
  if (!orderId) notFound();

  const supabase = await createServerSupabase();

  const [{ data: orderData }, { data: unitData }] = await Promise.all([
    supabase
      .from("orders_overview")
      .select(
        "id, number, business_name, product_name, quantity, contact_name, contact_phone, delivery_zone, delivery_town, delivery_area, delivery_notes",
      )
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("order_units")
      .select("unit_index, nfc_tags!order_units_tag_id_fkey(serial, variant)")
      .eq("order_id", orderId)
      .order("unit_index"),
  ]);

  const order = (orderData ?? null) as SlipOrder | null;
  if (!order) notFound();

  const units = ((unitData ?? []) as unknown as {
    unit_index: number;
    nfc_tags: { serial: string | null; variant: string | null } | { serial: string | null; variant: string | null }[] | null;
  }[]).map((u) => {
    const tag = Array.isArray(u.nfc_tags) ? (u.nfc_tags[0] ?? null) : u.nfc_tags;
    return { index: u.unit_index, serial: tag?.serial ?? null, variant: tag?.variant ?? null };
  });

  const destination = [
    order.delivery_town,
    order.delivery_zone ? ZONE_LABELS[order.delivery_zone] ?? order.delivery_zone : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="mx-auto max-w-[210mm] px-6 py-8 print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-page-title text-foreground">Packing slip</h1>
        <PrintButton />
      </div>

      <article className="rounded-lg border border-border bg-surface p-8 print:rounded-none print:border-0 print:p-0">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-caption text-muted">Hornbill TapTap</p>
            <p className="text-page-title text-foreground">{order.number}</p>
          </div>
          <div className="text-right">
            <p className="text-caption text-muted">
              {order.quantity} × {order.product_name}
            </p>
          </div>
        </header>

        <section className="mb-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-label text-muted">Deliver to</h2>
            <p className="text-body-sm font-medium text-foreground">
              {order.contact_name || order.business_name || "Customer"}
            </p>
            {order.business_name && order.contact_name && (
              <p className="text-body-sm text-muted">{order.business_name}</p>
            )}
            {order.contact_phone && <p className="text-body-sm text-muted">{order.contact_phone}</p>}
            {destination && <p className="text-body-sm text-muted">{destination}</p>}
            {order.delivery_area && <p className="text-body-sm text-muted">{order.delivery_area}</p>}
          </div>

          <div>
            <h2 className="mb-1 text-label text-muted">In this parcel</h2>
            {units.length === 0 ? (
              <p className="text-body-sm text-muted">Nothing assigned yet.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {units.map((u) => (
                  <li key={u.index} className="text-body-sm text-foreground">
                    <span className="font-mono">{u.serial ?? "not assigned"}</span>
                    {u.variant ? <span className="text-muted"> · {u.variant}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {order.delivery_notes && (
          <section className="mb-6 border-t border-border pt-4">
            <h2 className="mb-1 text-label text-muted">Delivery notes</h2>
            <p className="text-body-sm text-foreground">{order.delivery_notes}</p>
          </section>
        )}

        <section className="border-t border-border pt-4">
          <h2 className="mb-2 text-section-title text-foreground">Getting started</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-body-sm text-foreground">
            <li>Android: tap the back of your phone.</li>
            <li>iPhone: tap near the top.</li>
            <li>No NFC? Scan the QR on the back of the card.</li>
          </ol>
          <p className="mt-3 text-caption text-muted">
            Your card is ready to use. If it asks you to link a profile, sign in at
            taptap.hornbilltech.co.ke and pick the one it should open.
          </p>
        </section>
      </article>
    </main>
  );
}
