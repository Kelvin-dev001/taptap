import { notFound } from "next/navigation";
import { normalizeSlug } from "@/lib/slug";
import { isValidToken } from "@/lib/tags";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * Printable QR sheet — six cards to a page, cut lines included.
 *
 * Deliberately outside the dashboard shell: sidebar, header and nav have no
 * business on a page whose only job is to come out of a printer correctly.
 * Everything is driven by query params and rendered server-side, so there is
 * nothing to hydrate before printing.
 *
 * Uses SVG for the codes — a printed raster QR at this size looks ragged and
 * scans less reliably.
 */
export default async function PrintQrPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; token?: string; label?: string }>;
}) {
  const { slug: rawSlug, token, label } = await searchParams;
  const slug = normalizeSlug(rawSlug ?? "");
  if (!slug) notFound();
  if (token && !isValidToken(token)) notFound();

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const displayUrl = token
    ? `${base.replace(/^https?:\/\//, "")}/t/${token.slice(0, 6)}…`
    : `${base.replace(/^https?:\/\//, "")}/${slug}`;

  const src = `/api/qr/${encodeURIComponent(slug)}?format=svg&size=600${
    token ? `&token=${encodeURIComponent(token)}` : ""
  }`;

  const title = label?.trim() || slug;
  const cells = Array.from({ length: 6 });

  return (
    <main className="mx-auto max-w-[820px] p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-foreground">Print sheet — {title}</h1>
          <p className="text-body-sm text-muted">
            Six codes per A4 page. Print at 100% scale, then cut along the guides.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 gap-4 print:gap-0">
        {cells.map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 p-5 print:rounded-none print:border-neutral-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" width={150} height={150} className="h-[150px] w-[150px]" />
            <span className="text-center text-sm font-semibold text-black">{title}</span>
            <span className="text-center text-[10px] text-neutral-500">{displayUrl}</span>
            <span className="text-center text-[9px] text-neutral-400">
              Powered by Hornbill TapTap
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
