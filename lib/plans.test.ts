import { describe, it, expect } from "vitest";
import { planFor, withinProfileLimit, PLANS } from "./plans";

describe("planFor", () => {
  it("defaults unknown/empty to free", () => {
    expect(planFor(null).code).toBe("free");
    expect(planFor("nope").code).toBe("free");
  });
  it("resolves a known plan", () => {
    expect(planFor("pro").code).toBe("pro");
  });
});

describe("withinProfileLimit", () => {
  it("free allows the first profile only", () => {
    expect(withinProfileLimit(PLANS.free, 0)).toBe(true);
    expect(withinProfileLimit(PLANS.free, 1)).toBe(false);
  });
  it("pro allows up to its max", () => {
    expect(withinProfileLimit(PLANS.pro, 4)).toBe(true);
    expect(withinProfileLimit(PLANS.pro, 5)).toBe(false);
  });
  it("business is unlimited", () => {
    expect(withinProfileLimit(PLANS.business, 9999)).toBe(true);
  });
});
