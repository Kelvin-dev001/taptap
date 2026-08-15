import { describe, it, expect, beforeEach } from "vitest";
import {
  verifyAdminKey,
  isWeakAdminToken,
  __resetAdminRateLimit,
  MIN_ADMIN_TOKEN_LENGTH,
} from "./admin-auth";

const STRONG = "9f3c2a7b1d4e8a6c5b0f2d9e7a1c4b83";

beforeEach(() => __resetAdminRateLimit());

describe("isWeakAdminToken", () => {
  /**
   * The placeholder ships in .env.example, so copying it into the hosting
   * environment would publish the key that "secures" token minting.
   */
  it("rejects the shipped placeholder, however it is cased", () => {
    expect(isWeakAdminToken("change-me-to-a-long-random-string")).toBe(true);
    expect(isWeakAdminToken("CHANGE-ME-TO-A-LONG-RANDOM-STRING")).toBe(true);
    expect(isWeakAdminToken("  change-me-to-a-long-random-string  ")).toBe(true);
  });

  it("rejects obvious secrets even at length", () => {
    expect(isWeakAdminToken("password".padEnd(40, "1"))).toBe(true);
    expect(isWeakAdminToken("my-admin-token-is-secret-really".padEnd(40, "x"))).toBe(true);
  });

  it("rejects anything too short to be worth guessing at", () => {
    expect(isWeakAdminToken("a".repeat(MIN_ADMIN_TOKEN_LENGTH - 1))).toBe(true);
    expect(isWeakAdminToken("a".repeat(MIN_ADMIN_TOKEN_LENGTH))).toBe(false);
  });

  it("accepts a real random token", () => {
    expect(isWeakAdminToken(STRONG)).toBe(false);
  });
});

describe("verifyAdminKey", () => {
  it("accepts the correct key", () => {
    expect(verifyAdminKey(STRONG, STRONG)).toEqual({ ok: true });
  });

  it("rejects a wrong key", () => {
    expect(verifyAdminKey("nope", STRONG)).toEqual({ ok: false, reason: "invalid" });
  });

  it("reports a missing configuration distinctly from a wrong key", () => {
    expect(verifyAdminKey(STRONG, undefined)).toEqual({
      ok: false,
      reason: "not-configured",
    });
  });

  /**
   * Fails closed: a placeholder secret disables minting rather than pretending
   * the endpoint is protected.
   */
  it("refuses to authorise anything when the server token is weak", () => {
    const weak = "change-me-to-a-long-random-string";
    expect(verifyAdminKey(weak, weak)).toEqual({ ok: false, reason: "weak-token" });
  });

  it("does not accept a prefix of the real key", () => {
    expect(verifyAdminKey(STRONG.slice(0, -1), STRONG).ok).toBe(false);
    expect(verifyAdminKey(STRONG + "x", STRONG).ok).toBe(false);
  });

  it("rate-limits repeated guessing", () => {
    for (let i = 0; i < 10; i++) {
      expect(verifyAdminKey(`guess-${i}`, STRONG)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(verifyAdminKey("guess-11", STRONG)).toEqual({ ok: false, reason: "rate-limited" });
    // Even the correct key is refused while the window is saturated.
    expect(verifyAdminKey(STRONG, STRONG)).toEqual({ ok: false, reason: "rate-limited" });
  });

  it("forgets attempts once the window passes", () => {
    const start = 1_000_000;
    for (let i = 0; i < 10; i++) verifyAdminKey(`guess-${i}`, STRONG, start);
    expect(verifyAdminKey(STRONG, STRONG, start).ok).toBe(false);
    // 11 minutes later the window has rolled over.
    expect(verifyAdminKey(STRONG, STRONG, start + 11 * 60 * 1000)).toEqual({ ok: true });
  });

  it("does not count a successful attempt against the limit", () => {
    for (let i = 0; i < 9; i++) verifyAdminKey(STRONG, STRONG);
    expect(verifyAdminKey(STRONG, STRONG)).toEqual({ ok: true });
  });
});
