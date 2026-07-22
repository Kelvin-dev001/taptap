import QRCode from "qrcode";

// Node runtime — the qrcode library needs Node APIs.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const target = `${base}/${encodeURIComponent(slug)}?src=qr`;

  const png = await QRCode.toBuffer(target, { width: 512, margin: 2 });

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="${slug}-qr.png"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
