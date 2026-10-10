import {
  CODE_LENGTH,
  isPlausibleEmail,
  newPasswordProblem,
  normaliseEmail,
  sanitiseCode,
} from "./validation";

describe("email", () => {
  it("normalises what people type", () => {
    expect(normaliseEmail("  Owner@Business.CO.KE ")).toBe("owner@business.co.ke");
  });

  it("accepts ordinary addresses", () => {
    for (const ok of ["owner@business.co.ke", "a.b+tag@gmail.com", " Jane@Hornbilltech.co.ke "]) {
      expect(isPlausibleEmail(ok)).toBe(true);
    }
  });

  it("catches common slips", () => {
    for (const bad of [
      "",
      "owner",
      "owner@gmail",
      "owner gmail.com",
      "owner@@gmail.com",
      "@gmail.com",
    ]) {
      expect(isPlausibleEmail(bad)).toBe(false);
    }
  });
});

describe("sanitiseCode", () => {
  it("keeps digits only, up to the code length", () => {
    expect(sanitiseCode("123 456")).toBe("123456");
    expect(sanitiseCode("12-34-56")).toBe("123456");
    expect(sanitiseCode("1234567890")).toHaveLength(CODE_LENGTH);
    expect(sanitiseCode("abc")).toBe("");
  });
});

describe("newPasswordProblem", () => {
  it("needs eight characters", () => {
    expect(newPasswordProblem("short", "short")).toBe("tooShort");
    expect(newPasswordProblem("1234567", "1234567")).toBe("tooShort");
  });

  it("needs both entries to match", () => {
    expect(newPasswordProblem("long enough", "long enougH")).toBe("mismatch");
  });

  it("accepts a good password", () => {
    expect(newPasswordProblem("long enough", "long enough")).toBeNull();
  });
});
