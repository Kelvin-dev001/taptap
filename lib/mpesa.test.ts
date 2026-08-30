import { describe, it, expect } from "vitest";
import { normalizePhone, isPlaceholderCredential, mpesaBaseUrl } from "./mpesa";

describe("normalizePhone", () => {
  it("accepts the formats a Kenyan customer actually types", () => {
    expect(normalizePhone("0712345678")).toBe("254712345678");
    expect(normalizePhone("254712345678")).toBe("254712345678");
    expect(normalizePhone("712345678")).toBe("254712345678");
    expect(normalizePhone("+254 712 345 678")).toBe("254712345678");
    expect(normalizePhone("0110 123 456")).toBe("254110123456");
  });

  it("rejects what is not a Safaricom-format number", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("0812345678")).toBeNull();
    expect(normalizePhone("07123456789")).toBeNull();
  });
});

describe("isPlaceholderCredential", () => {
  /**
   * The bug this closes, found while a real sandbox test failed: `.env.local`
   * held `PASTE_YOUR_CONSUMER_KEY` verbatim. Daraja answered 400 with an empty
   * body and the app said only "M-Pesa auth failed", so nothing pointed at the
   * credentials never having been filled in. Same class as the placeholder
   * check in lib/admin-auth.ts.
   */
  it("catches the placeholders shipped in .env.example", () => {
    expect(isPlaceholderCredential("PASTE_YOUR_CONSUMER_KEY")).toBe(true);
    expect(isPlaceholderCredential("PASTE_YOUR_CONSUMER_SECRET")).toBe(true);
    expect(isPlaceholderCredential("your-consumer-key")).toBe(true);
    expect(isPlaceholderCredential("change-me")).toBe(true);
    expect(isPlaceholderCredential("TODO")).toBe(true);
    expect(isPlaceholderCredential("xxxxxxxx")).toBe(true);
  });

  it("treats empty or blank as unset", () => {
    expect(isPlaceholderCredential("")).toBe(true);
    expect(isPlaceholderCredential("   ")).toBe(true);
  });

  it("lets a real-looking credential through", () => {
    expect(isPlaceholderCredential("GjaLGvkZ0Gm2Q4dMh1AKZ0ZAFDkKGnbQ")).toBe(false);
    expect(isPlaceholderCredential("A7bQ2xR9")).toBe(false);
  });
});

describe("mpesaBaseUrl", () => {
  it("resolves the two valid environments", () => {
    expect(mpesaBaseUrl("sandbox")).toBe("https://sandbox.safaricom.co.ke");
    expect(mpesaBaseUrl("production")).toBe("https://api.safaricom.co.ke");
    expect(mpesaBaseUrl(" Production ")).toBe("https://api.safaricom.co.ke");
  });

  it("defaults to sandbox when unset", () => {
    expect(mpesaBaseUrl(undefined)).toBe("https://sandbox.safaricom.co.ke");
  });

  /**
   * The old behaviour was "anything that isn't production means sandbox", which
   * is safe in one direction and dangerous in the other: `prodution` would have
   * run live payments against the sandbox, and the symptom would have looked
   * like customers not being charged rather than a misconfiguration.
   */
  it("refuses to guess at a typo", () => {
    expect(() => mpesaBaseUrl("sandbox9")).toThrow(/exactly/i);
    expect(() => mpesaBaseUrl("prodution")).toThrow(/exactly/i);
    expect(() => mpesaBaseUrl("live")).toThrow(/exactly/i);
  });
});
