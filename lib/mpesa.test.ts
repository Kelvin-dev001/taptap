import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  isPlaceholderCredential,
  mpesaBaseUrl,
  readStkOutcome,
  describeStkFailure,
} from "./mpesa";

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

/**
 * Reading Daraja's STK query response.
 *
 * The polling added in Sprint 7 resolves the checkout from this, so every case
 * here is the difference between a screen that finishes and one that spins
 * forever.
 */
describe("readStkOutcome", () => {
  it("reads a success", () => {
    const out = readStkOutcome({ ResultCode: "0", ResultDesc: "The service request is processed successfully." });
    expect(out.state).toBe("paid");
  });

  /**
   * The query endpoint returns ResultCode as a STRING and the callback returns
   * it as a NUMBER. Comparing with === against 0 works for one and silently
   * fails for the other, which is exactly how a paid customer ends up watching
   * a spinner.
   */
  it("does not care whether the code arrived as a string or a number", () => {
    expect(readStkOutcome({ ResultCode: 0 }).state).toBe("paid");
    expect(readStkOutcome({ ResultCode: "0" }).state).toBe("paid");
    expect(readStkOutcome({ ResultCode: 1032 }).state).toBe("failed");
    expect(readStkOutcome({ ResultCode: "1032" }).state).toBe("failed");
  });

  /**
   * Daraja answers "still being processed" as an error object with no
   * ResultCode while the prompt is on the phone. Treating that as a failure
   * would tell someone their payment failed while they were typing their PIN.
   */
  it("returns unknown rather than guessing", () => {
    expect(readStkOutcome({ errorCode: "500.001.1001", errorMessage: "in process" }).state).toBe("unknown");
    expect(readStkOutcome({}).state).toBe("unknown");
    expect(readStkOutcome(null).state).toBe("unknown");
    expect(readStkOutcome({ ResultCode: "" }).state).toBe("unknown");
    expect(readStkOutcome({ ResultCode: "not-a-number" }).state).toBe("unknown");
  });

  it("carries Safaricom's own description when there is one", () => {
    const out = readStkOutcome({ ResultCode: 1, ResultDesc: "The balance is insufficient" });
    expect(out.state === "failed" && out.description).toMatch(/balance is insufficient/i);
  });

  it("falls back to our own wording when there is not", () => {
    const out = readStkOutcome({ ResultCode: 1032 });
    expect(out.state === "failed" && out.description).toMatch(/cancelled on the phone/i);
  });
});

describe("describeStkFailure", () => {
  /**
   * The common codes are worth saying plainly, because they are the difference
   * between a customer retrying and a customer giving up.
   */
  it("explains the failures a customer can act on", () => {
    expect(describeStkFailure(1)).toMatch(/not enough money/i);
    expect(describeStkFailure(1032)).toMatch(/cancelled/i);
    expect(describeStkFailure(1037)).toMatch(/timed out/i);
    expect(describeStkFailure(2001)).toMatch(/PIN was wrong/i);
  });

  it("says something useful about a code it does not know", () => {
    expect(describeStkFailure(9999)).toMatch(/did not complete/i);
  });

  /** House style: no em dashes in anything a customer reads. */
  it("uses no em dash", () => {
    for (const code of [1, 1001, 1032, 1037, 2001, 9999]) {
      expect(describeStkFailure(code)).not.toContain("—");
    }
  });
});
