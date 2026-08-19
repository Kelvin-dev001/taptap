import { describe, it, expect } from "vitest";
import { safeNext } from "./route";

/**
 * `next` arrives from a URL inside an email, so it is attacker-controllable.
 * An unchecked value is an open redirect that fires on a session that has just
 * been authenticated — the worst moment for one, because the victim is signed
 * in and primed to trust wherever they land.
 *
 * Verified here rather than against production: reaching this code needs a
 * valid one-time code, and probing the deployed route with a fake one fails at
 * the exchange and never gets far enough to exercise the guard.
 */
describe("safeNext", () => {
  it("defaults to the dashboard", () => {
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
  });

  it("allows ordinary in-app paths", () => {
    expect(safeNext("/dashboard/devices")).toBe("/dashboard/devices");
    expect(safeNext("/dashboard/profiles?filter=card")).toBe("/dashboard/profiles?filter=card");
  });

  it("rejects absolute URLs to other origins", () => {
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("http://evil.example/steal")).toBe("/dashboard");
  });

  /** Browsers resolve a protocol-relative URL against the current scheme, so
   *  `//evil.example` is absolute despite the leading slash. */
  it("rejects protocol-relative URLs", () => {
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("//evil.example/path")).toBe("/dashboard");
  });

  it("rejects anything that is not a rooted path", () => {
    expect(safeNext("dashboard")).toBe("/dashboard");
    expect(safeNext("javascript:alert(1)")).toBe("/dashboard");
    expect(safeNext("mailto:someone@example.com")).toBe("/dashboard");
  });

  it("never returns a value that could leave the site", () => {
    const hostile = [
      "https://evil.example",
      "//evil.example",
      "http:/evil.example",
      "javascript:alert(1)",
      "dashboard",
      "",
      null,
    ];
    for (const input of hostile) {
      const out = safeNext(input);
      expect(out.startsWith("/")).toBe(true);
      expect(out.startsWith("//")).toBe(false);
    }
  });
});
