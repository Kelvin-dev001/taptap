import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins headers and rows", () => {
    expect(toCsv(["a", "b"], [["1", "2"], ["3", "4"]])).toBe("a,b\r\n1,2\r\n3,4");
  });
  it("escapes commas, quotes and newlines", () => {
    expect(toCsv(["x"], [['a,"b"\nc']])).toBe('x\r\n"a,""b""\nc"');
  });
  it("handles null / undefined", () => {
    expect(toCsv(["x", "y"], [[null, undefined]])).toBe("x,y\r\n,");
  });
});
