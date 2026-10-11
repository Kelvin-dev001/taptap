import { base64Bytes, base64ToBytes, encodeWithin, PHOTO_MAX_BYTES, PhotoTooLargeError, QUALITIES } from "./photo";

jest.mock("@/api/supabase", () => ({ supabase: {} }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-image-picker", () => ({}));

/** A base64 string that decodes to exactly `bytes` bytes. */
const ofSize = (bytes: number) => "A".repeat(Math.ceil(bytes / 3) * 4).slice(0, Math.ceil((bytes * 4) / 3));

describe("encodeWithin", () => {
  it("keeps the best quality that fits under 300 KB", async () => {
    const encode = jest.fn(async (q: number) => ofSize(q >= 0.8 ? 400_000 : 250_000));
    const out = await encodeWithin(encode);
    expect(base64Bytes(out)).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
    expect(encode.mock.calls.map(([q]) => q)).toEqual([0.8, 0.65]);
  });

  it("stops at the first quality when it already fits", async () => {
    const encode = jest.fn(async () => ofSize(80_000));
    await encodeWithin(encode);
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it("gives up rather than upload something too big", async () => {
    const encode = jest.fn(async () => ofSize(PHOTO_MAX_BYTES + 1));
    await expect(encodeWithin(encode)).rejects.toBeInstanceOf(PhotoTooLargeError);
    expect(encode).toHaveBeenCalledTimes(QUALITIES.length);
  });

  it("measures the limit in decoded bytes, not characters", async () => {
    const exactly = ofSize(PHOTO_MAX_BYTES);
    expect(base64Bytes(exactly)).toBe(PHOTO_MAX_BYTES);
    await expect(encodeWithin(async () => exactly)).resolves.toBe(exactly);
  });
});

describe("base64", () => {
  it("counts decoded bytes, padding included", () => {
    expect(base64Bytes("TWFu")).toBe(3);
    expect(base64Bytes("TWE=")).toBe(2);
    expect(base64Bytes("TQ==")).toBe(1);
  });

  it("decodes what Buffer encodes, at every padding length", () => {
    for (const text of ["", "M", "Ma", "Man", "Hornbill TapTap ✓", "\u0000ÿ binary"]) {
      const bytes = Buffer.from(text, "utf8");
      expect(Array.from(base64ToBytes(bytes.toString("base64")))).toEqual(Array.from(bytes));
    }
    const random = Buffer.from(Array.from({ length: 1000 }, (_, i) => (i * 37) % 256));
    expect(Buffer.from(base64ToBytes(random.toString("base64"))).equals(random)).toBe(true);
  });
});
