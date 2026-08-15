import { describe, it, expect } from "vitest";
import {
  buildHref,
  defaultLabel,
  blockDef,
  isNavigational,
  BLOCK_DEFS,
  BLOCK_GROUPS,
} from "./blocks";
import type { BlockType } from "./profile";

describe("buildHref", () => {
  it("builds tel, mailto and wa.me links", () => {
    expect(buildHref("call", "+254712345678")).toBe("tel:+254712345678");
    expect(buildHref("email", "hi@java.co.ke")).toBe("mailto:hi@java.co.ke");
    expect(buildHref("whatsapp", "+254 712 345 678")).toBe("https://wa.me/254712345678");
  });

  it("adds a scheme to bare domains", () => {
    expect(buildHref("website", "javahouse.co.ke")).toBe("https://javahouse.co.ke");
    expect(buildHref("website", "http://javahouse.co.ke")).toBe("http://javahouse.co.ke");
  });

  it("turns a plain address into a Maps search", () => {
    expect(buildHref("directions", "Westlands, Nairobi")).toContain(
      "google.com/maps/search/?api=1&query=Westlands%2C%20Nairobi",
    );
  });

  it("passes a Maps URL through untouched", () => {
    expect(buildHref("directions", "https://maps.app.goo.gl/x")).toBe(
      "https://maps.app.goo.gl/x",
    );
  });

  it("handles the block types added in UI-4", () => {
    expect(buildHref("youtube", "youtube.com/@java")).toBe("https://youtube.com/@java");
    expect(buildHref("menu", "java.co.ke/menu.pdf")).toBe("https://java.co.ke/menu.pdf");
    expect(buildHref("booking", "calendly.com/java")).toBe("https://calendly.com/java");
  });

  /**
   * M-Pesa is not a link. TapTap shows a till/paybill for the customer to
   * enter — it never initiates, and certainly never confirms, a payment
   * (CLAUDE.md §15).
   */
  it("returns no href for M-Pesa and vCard, which act in-page", () => {
    expect(buildHref("mpesa", "Till 123456")).toBeNull();
    expect(buildHref("contact", "")).toBeNull();
  });

  it("returns null for empty values rather than a broken link", () => {
    for (const type of ["website", "whatsapp", "call", "email", "menu"] as BlockType[]) {
      expect(buildHref(type, "")).toBeNull();
      expect(buildHref(type, "   ")).toBeNull();
    }
  });
});

describe("isNavigational", () => {
  it("marks only in-page actions as non-navigational", () => {
    expect(isNavigational("contact")).toBe(false);
    expect(isNavigational("mpesa")).toBe(false);
    expect(isNavigational("whatsapp")).toBe(true);
    expect(isNavigational("google_review")).toBe(true);
  });
});

describe("block definitions", () => {
  it("gives every type a label, description and group", () => {
    for (const def of BLOCK_DEFS) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(BLOCK_GROUPS).toContain(def.group);
    }
  });

  it("has no duplicate types", () => {
    const types = BLOCK_DEFS.map((d) => d.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("leads with the actions Kenyan SMEs use most (§22)", () => {
    const popular = BLOCK_DEFS.filter((d) => d.group === "Popular in Kenya").map((d) => d.type);
    expect(popular).toContain("whatsapp");
    expect(popular).toContain("google_review");
    expect(popular).toContain("mpesa");
    expect(BLOCK_DEFS[0].group).toBe("Popular in Kenya");
  });

  it("falls back to a sensible label for an unknown type", () => {
    expect(defaultLabel("whatsapp")).toBe("WhatsApp");
    expect(defaultLabel("nonsense" as BlockType)).toBe("Link");
    expect(blockDef("nonsense" as BlockType)).toBeUndefined();
  });

  it("requires a value for everything except the vCard action", () => {
    for (const def of BLOCK_DEFS) {
      expect(def.needsValue).toBe(def.type !== "contact");
    }
  });
});
