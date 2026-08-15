import { describe, it, expect, vi, beforeAll } from "vitest";

/**
 * The QR endpoint backs both the on-screen preview and the download button, so
 * its query handling has to be predictable: a printed code that encodes the
 * wrong URL is only discovered after a batch of stickers has been made.
 */
vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(async () => Buffer.from("png")),
    toString: vi.fn(async () => "<svg/>"),
  },
}));

let GET: typeof import("./route").GET;
let QRCode: { toBuffer: ReturnType<typeof vi.fn>; toString: ReturnType<typeof vi.fn> };

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://taptap.hornbilltech.co.ke";
  QRCode = (await import("qrcode")).default as never;
  GET = (await import("./route")).GET;
});

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const call = (url: string, slug = "java-house") => GET(new Request(url), params(slug));

describe("GET /api/qr/[slug]", () => {
  it("encodes the slug URL with a QR source marker", async () => {
    await call("https://x.test/api/qr/java-house");
    expect(QRCode.toBuffer).toHaveBeenCalledWith(
      "https://taptap.hornbilltech.co.ke/java-house?src=qr",
      expect.anything(),
    );
  });

  /**
   * A printed card should point at the permanent token URL: the business can
   * then rename its slug without invalidating a box of printed stickers.
   */
  it("encodes the permanent card URL when a token is given", async () => {
    await call("https://x.test/api/qr/java-house?token=abc123def456");
    expect(QRCode.toBuffer).toHaveBeenCalledWith(
      "https://taptap.hornbilltech.co.ke/t/abc123def456",
      expect.anything(),
    );
  });

  it("returns SVG when asked, for print", async () => {
    const res = await call("https://x.test/api/qr/java-house?format=svg");
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
  });

  it("returns PNG by default", async () => {
    const res = await call("https://x.test/api/qr/java-house");
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("clamps the size rather than trusting the query string", async () => {
    await call("https://x.test/api/qr/java-house?size=99999");
    expect(QRCode.toBuffer).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ width: 2048 }),
    );

    await call("https://x.test/api/qr/java-house?size=1");
    expect(QRCode.toBuffer).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ width: 256 }),
    );

    await call("https://x.test/api/qr/java-house?size=notanumber");
    expect(QRCode.toBuffer).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ width: 512 }),
    );
  });

  /**
   * Regression: `Number(null)` is 0 and 0 is finite, so testing the parsed
   * value alone clamped a missing size to the 256 minimum — every preview and
   * download silently came out at the smallest size instead of the default.
   */
  it("uses the default size when none is given", async () => {
    await call("https://x.test/api/qr/java-house");
    expect(QRCode.toBuffer).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ width: 512 }),
    );
  });

  it("uses high error correction, because these get printed and scuffed", async () => {
    await call("https://x.test/api/qr/java-house");
    expect(QRCode.toBuffer).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ errorCorrectionLevel: "Q" }),
    );
  });

  it("serves inline for preview and as an attachment on download", async () => {
    const inline = await call("https://x.test/api/qr/java-house");
    expect(inline.headers.get("content-disposition")).toContain("inline");

    const attached = await call("https://x.test/api/qr/java-house?download=1");
    expect(attached.headers.get("content-disposition")).toContain("attachment");
  });

  it("escapes the slug it encodes", async () => {
    await call("https://x.test/api/qr/a%20b", "a b");
    expect(QRCode.toBuffer).toHaveBeenLastCalledWith(
      expect.stringContaining("a%20b"),
      expect.anything(),
    );
  });
});
