import { describe, it, expect } from "vitest";
import { buildHref } from "./blocks";

describe("buildHref", () => {
  it("call -> tel", () => {
    expect(buildHref("call", "+254712345678")).toBe("tel:+254712345678");
  });
  it("whatsapp -> wa.me with digits only", () => {
    expect(buildHref("whatsapp", "+254 712 345 678")).toBe(
      "https://wa.me/254712345678",
    );
  });
  it("email -> mailto", () => {
    expect(buildHref("email", "a@b.com")).toBe("mailto:a@b.com");
  });
  it("website adds https scheme", () => {
    expect(buildHref("website", "example.com")).toBe("https://example.com");
  });
  it("website keeps existing scheme", () => {
    expect(buildHref("website", "http://x.com")).toBe("http://x.com");
  });
  it("directions builds a maps query", () => {
    expect(buildHref("directions", "Java House Nairobi")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Java%20House%20Nairobi",
    );
  });
  it("directions keeps a url", () => {
    expect(buildHref("directions", "https://maps.google.com/x")).toBe(
      "https://maps.google.com/x",
    );
  });
  it("contact -> null (handled via vCard)", () => {
    expect(buildHref("contact", "")).toBeNull();
  });
  it("empty value -> null", () => {
    expect(buildHref("website", "")).toBeNull();
  });
});
