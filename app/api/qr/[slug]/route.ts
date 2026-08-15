import QRCode from "qrcode";

// Node runtime — the qrcode library needs Node APIs.

const MIN_SIZE = 256;
const MAX_SIZE = 2048;
const DEFAULT_SIZE = 512;

/**
 * QR image for a slug or a card token.
 *
 * Query:
 *   format=png|svg   default png. SVG is the one to send to a printer — it
 *                    stays sharp at any physical size, where a raster does not.
 *   size=<px>        PNG only, clamped to 256–2048.
 *   download=1       force a download instead of inline display, so the same
 *                    URL can back both the on-screen preview and the button.
 *   token=<token>    encode /t/<token> (the permanent card URL) instead of the
 *                    slug. A printed QR that points at the card token survives
 *                    the business renaming its link.
 *
 * Error correction is fixed at Q (~25%): these get printed on stickers and
 * table tents that pick up scratches and grease, and the extra redundancy costs
 * only a slightly denser code.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  const token = url.searchParams.get("token");
  const target = token
    ? `${base}/t/${encodeURIComponent(token)}`
    : `${base}/${encodeURIComponent(slug)}?src=qr`;

  const format = url.searchParams.get("format") === "svg" ? "svg" : "png";
  // `Number(null)` is 0, which is finite — so testing the parsed value alone
  // would clamp a MISSING size to the minimum instead of using the default.
  const sizeParam = url.searchParams.get("size");
  const requested = sizeParam === null ? Number.NaN : Number(sizeParam);
  const size = Number.isFinite(requested)
    ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(requested)))
    : DEFAULT_SIZE;

  const download = url.searchParams.get("download") === "1";
  const filename = `${token ? `card-${token.slice(-6)}` : slug}-qr.${format}`;
  const disposition = download
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;

  const options = {
    errorCorrectionLevel: "Q" as const,
    margin: 2,
    color: { dark: "#111111", light: "#ffffff" },
  };

  if (format === "svg") {
    const svg = await QRCode.toString(target, { ...options, type: "svg", width: size });
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml",
        "content-disposition": disposition,
        "cache-control": "public, max-age=3600",
      },
    });
  }

  const png = await QRCode.toBuffer(target, { ...options, width: size });
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": disposition,
      "cache-control": "public, max-age=3600",
    },
  });
}
