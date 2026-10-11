// The encoder only — not the package root, which brings canvas and PNG
// renderers the app does not need. Same library and version as the web's QR
// endpoint (app/api/qr/[slug]/route.ts), so both draw the same code.
import { create } from "qrcode/lib/core/qrcode";

/**
 * A QR code as one SVG path (PLAN.md §8 Home: the QR is drawn on the phone, so
 * it works offline). Settings match the web's endpoint: error correction Q,
 * because codes get shown on cracked screens and printed on greasy stickers,
 * and a 2-module quiet zone.
 *
 * `size` includes the quiet zone; draw it in a `0 0 size size` viewBox.
 */
export const QR_MARGIN = 2;

export function qrPath(text: string): { size: number; d: string } {
  const { modules } = create(text, { errorCorrectionLevel: "Q" });
  const n = modules.size;
  let d = "";
  for (let row = 0; row < n; row++) {
    let col = 0;
    while (col < n) {
      if (!modules.get(row, col)) {
        col++;
        continue;
      }
      // One rectangle per run of dark modules in a row keeps the path short.
      const start = col;
      while (col < n && modules.get(row, col)) col++;
      d += `M${start + QR_MARGIN} ${row + QR_MARGIN}h${col - start}v1h-${col - start}z`;
    }
  }
  return { size: n + QR_MARGIN * 2, d };
}
