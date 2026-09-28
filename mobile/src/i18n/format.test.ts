import { formatNumber } from "./format";

describe("formatNumber", () => {
  it("groups thousands the Kenyan way", () => {
    expect(formatNumber(1284)).toBe("1,284");
    expect(formatNumber(1500000)).toBe("1,500,000");
    expect(formatNumber(0)).toBe("0");
  });
});
