import { describe, it, expect } from "vitest";
import { generateToken, isValidToken, tokenUrl } from "./tags";

describe("tags", () => {
  it("generates a 32-char hex token", () => {
    const t = generateToken();
    expect(t).toMatch(/^[a-f0-9]{32}$/);
    expect(isValidToken(t)).toBe(true);
  });
  it("generates unique tokens", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
  it("rejects invalid tokens", () => {
    expect(isValidToken("")).toBe(false);
    expect(isValidToken("not-a-token")).toBe(false);
    expect(isValidToken("ABC123")).toBe(false);
    expect(isValidToken(null)).toBe(false);
  });
  it("builds a tap URL and trims a trailing slash on base", () => {
    expect(tokenUrl("https://taptap.hornbilltech.co.ke/", "abc")).toBe(
      "https://taptap.hornbilltech.co.ke/t/abc",
    );
  });
});
