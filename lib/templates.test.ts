import { describe, it, expect } from "vitest";
import {
  templateOf,
  templateDef,
  roleLine,
  seedBlocks,
  TEMPLATES,
  TEMPLATE_ORDER,
} from "./templates";
import { defaultLabel } from "./blocks";
import type { PageConfig } from "./profile";

describe("templateOf", () => {
  it("treats everything created before templates existed as a business page", () => {
    expect(templateOf(undefined)).toBe("business");
    expect(templateOf(null)).toBe("business");
    expect(templateOf({})).toBe("business");
  });

  it("reads an explicit template", () => {
    expect(templateOf({ template: "card" })).toBe("card");
    expect(templateOf({ template: "business" })).toBe("business");
  });

  it("falls back safely on an unknown value", () => {
    expect(templateOf({ template: "nonsense" } as unknown as PageConfig)).toBe("business");
    expect(templateDef("nonsense" as never).id).toBe("business");
  });
});

describe("roleLine", () => {
  it("prefers an explicit tagline", () => {
    expect(roleLine({ tagline: "Coffee · Westlands", template: "card" })).toBe(
      "Coffee · Westlands",
    );
  });

  /**
   * A card's subtitle is derived from the vCard fields, so the line under the
   * name can never disagree with the contact a visitor downloads.
   */
  it("builds a card's line from the vCard title and company", () => {
    expect(
      roleLine({ template: "card", contact: { title: "Sales Director", org: "Hornbill" } }),
    ).toBe("Sales Director · Hornbill");
  });

  it("copes with only one of the two", () => {
    expect(roleLine({ template: "card", contact: { title: "Photographer" } })).toBe(
      "Photographer",
    );
    expect(roleLine({ template: "card", contact: { org: "Hornbill" } })).toBe("Hornbill");
  });

  it("returns nothing when there is nothing to say", () => {
    expect(roleLine({ template: "card" })).toBeUndefined();
    expect(roleLine({ template: "card", contact: { phone: "0712" } })).toBeUndefined();
  });

  it("does not derive a line for business pages", () => {
    expect(roleLine({ template: "business", contact: { title: "Owner", org: "X" } })).toBeUndefined();
  });
});

describe("seedBlocks", () => {
  const source = {
    phone: "0712345678",
    whatsapp: "0722000000",
    website: "https://java.co.ke",
    googleReviewUrl: "https://g.page/r/x",
    location: "Westlands, Nairobi",
  };

  it("seeds a business page in review-first order", () => {
    const seeds = seedBlocks("business", source, defaultLabel);
    expect(seeds.map((b) => b.type)).toEqual([
      "google_review",
      "whatsapp",
      "call",
      "directions",
      "website",
    ]);
  });

  it("seeds a card contact-first", () => {
    const seeds = seedBlocks("card", source, defaultLabel);
    expect(seeds[0].type).toBe("contact");
  });

  /**
   * The rule that makes seeding safe: a seeded button with nothing behind it is
   * a dead button on a customer's phone.
   */
  it("never seeds an action with no value", () => {
    const seeds = seedBlocks("business", { phone: "0712345678" }, defaultLabel);
    expect(seeds.map((b) => b.type)).toEqual(["whatsapp", "call"]);
    for (const seed of seeds) {
      expect(seed.value.length).toBeGreaterThan(0);
    }
  });

  it("seeds nothing for a business page when Settings is empty", () => {
    expect(seedBlocks("business", {}, defaultLabel)).toEqual([]);
  });

  it("still seeds the vCard action for a card, since it needs no value", () => {
    const seeds = seedBlocks("card", {}, defaultLabel);
    expect(seeds).toHaveLength(1);
    expect(seeds[0].type).toBe("contact");
  });

  it("falls back to the phone number for WhatsApp when none is set", () => {
    const seeds = seedBlocks("business", { phone: "0712345678" }, defaultLabel);
    expect(seeds.find((b) => b.type === "whatsapp")?.value).toBe("0712345678");
  });

  it("gives every seeded block a human label", () => {
    for (const seed of seedBlocks("card", source, defaultLabel)) {
      expect(seed.label.length).toBeGreaterThan(0);
      expect(seed.label).not.toBe("Link");
    }
  });
});

describe("template definitions", () => {
  it("covers every ordered template", () => {
    for (const id of TEMPLATE_ORDER) {
      const def = TEMPLATES[id];
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.seedOrder.length).toBeGreaterThan(0);
    }
  });

  it("puts contact details first only for the card", () => {
    expect(TEMPLATES.card.contactFirst).toBe(true);
    expect(TEMPLATES.business.contactFirst).toBe(false);
  });
});
