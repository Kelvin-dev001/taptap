import { describe, expect, it } from "vitest";
import { checkPhone } from "./phone";

describe("checkPhone", () => {
  it.each([
    ["0722000000", "254722000000"],
    ["0110 123 456", "254110123456"],
    ["722000000", "254722000000"],
    ["+254 722 000 000", "254722000000"],
    ["254-722-000-000", "254722000000"],
    ["(0722) 000-000", "254722000000"],
    ["020 123 4567", "254201234567"],
  ])("accepts %s as %s", (input, international) => {
    expect(checkPhone(input)).toEqual({ ok: true, international });
  });

  it("accepts numbers from other countries written with +", () => {
    expect(checkPhone("+44 20 7946 0958")).toEqual({ ok: true, international: "442079460958" });
    expect(checkPhone("+1 (555) 010-9999")).toEqual({ ok: true, international: "15550109999" });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["call me", "invalid"],
    ["0722 OOO OOO", "invalid"],
    ["0722-000-00", "tooShort"],
    ["07220000001", "tooLong"],
    ["+254 0722 000 000", "tooLong"],
    ["+1 555", "tooShort"],
    ["+1 5550 1099 9999 999", "tooLong"],
  ])("refuses %j (%s)", (input, reason) => {
    expect(checkPhone(input)).toEqual({ ok: false, reason });
  });
});
