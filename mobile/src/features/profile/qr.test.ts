import { create } from "qrcode/lib/core/qrcode";
import { QR_MARGIN, qrPath } from "./qr";

/** Turns the path back into the set of dark modules it paints. */
function paintedModules(d: string): Set<string> {
  const dark = new Set<string>();
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(w); i++) dark.add(`${Number(y) - QR_MARGIN},${Number(x) - QR_MARGIN + i}`);
  }
  return dark;
}

describe("qrPath", () => {
  const url = "https://taptap.hornbilltech.co.ke/mama-njeri?src=qr";

  it("paints exactly the dark modules of the code, inside a 2-module quiet zone", () => {
    const { modules } = create(url, { errorCorrectionLevel: "Q" });
    const expected = new Set<string>();
    for (let r = 0; r < modules.size; r++) {
      for (let c = 0; c < modules.size; c++) if (modules.get(r, c)) expected.add(`${r},${c}`);
    }
    const { size, d } = qrPath(url);
    expect(size).toBe(modules.size + 2 * QR_MARGIN);
    expect(paintedModules(d)).toEqual(expected);
  });

  it("uses error correction Q, like the web's QR endpoint", () => {
    // Q needs a bigger symbol than M for the same text; equal sizes would mean M.
    const q = create(url, { errorCorrectionLevel: "Q" }).modules.size;
    const m = create(url, { errorCorrectionLevel: "M" }).modules.size;
    expect(q).toBeGreaterThan(m);
    expect(qrPath(url).size - 2 * QR_MARGIN).toBe(q);
  });

  it("refuses empty text rather than drawing nothing", () => {
    expect(() => qrPath("")).toThrow();
  });
});
