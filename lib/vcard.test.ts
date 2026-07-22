import { describe, it, expect } from "vitest";
import { buildVCard } from "./vcard";

describe("buildVCard", () => {
  it("includes FN and provided fields", () => {
    const v = buildVCard({
      fullName: "Amina W",
      org: "Java House",
      phone: "+254712000000",
      email: "a@j.com",
    });
    expect(v).toContain("BEGIN:VCARD");
    expect(v).toContain("FN:Amina W");
    expect(v).toContain("ORG:Java House");
    expect(v).toContain("TEL;TYPE=CELL:+254712000000");
    expect(v).toContain("EMAIL:a@j.com");
    expect(v).toContain("END:VCARD");
  });
  it("uses the fallback name when none provided", () => {
    expect(buildVCard({}, "Fallback")).toContain("FN:Fallback");
  });
  it("escapes special characters", () => {
    expect(buildVCard({ fullName: "A, B; C" })).toContain("FN:A\\, B\\; C");
  });
});
