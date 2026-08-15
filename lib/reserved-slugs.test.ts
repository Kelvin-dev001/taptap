import { describe, it, expect } from "vitest";
import { RESERVED_SLUGS } from "./reserved-slugs";
import { validateSlug } from "./slug";

/**
 * `/[slug]` is a root catch-all, so every path the platform serves from the
 * root must be withheld from customers. Reserving is free before launch and
 * breaking afterwards, so each sprint that adds a root route adds a test here.
 */
describe("reserved slugs", () => {
  const mustBeReserved = [
    // Platform routes that have always existed
    "api", "admin", "dashboard", "login", "t",
    // UI-2: future nav vocabulary
    "analytics", "customers", "devices", "leads", "cards", "qr", "team",
    // UI-6: printable sheets
    "print",
    // UI-11: PWA and metadata routes served from the root
    "offline", "icon", "apple-icon", "manifest", "sw", "robots", "sitemap",
  ];

  it.each(mustBeReserved)("reserves %s", (slug) => {
    expect(RESERVED_SLUGS.has(slug)).toBe(true);
  });

  it("rejects a reserved name through the public validator", () => {
    for (const slug of ["icon", "offline", "print", "manifest"]) {
      const result = validateSlug(slug);
      expect(result.valid, `${slug} should be rejected`).toBe(false);
    }
  });

  it("still accepts ordinary business names", () => {
    for (const slug of ["java-house", "kilimani-salon", "amina-wanjiru", "shop254"]) {
      expect(validateSlug(slug).valid, `${slug} should be allowed`).toBe(true);
    }
  });

  it("catches reserved names however they are typed", () => {
    // validateSlug normalises first, so casing and spacing cannot slip past.
    expect(validateSlug("  ICON  ").valid).toBe(false);
    expect(validateSlug("Dashboard").valid).toBe(false);
  });
});
