import { describe, it, expect } from "vitest";
import { NAV_ITEMS } from "./nav";
import { RESERVED_SLUGS } from "./reserved-slugs";

describe("navigation", () => {
  it("only routes under /dashboard, so nothing collides with the /[slug] catch-all", () => {
    for (const item of NAV_ITEMS) {
      expect(item.href.startsWith("/dashboard")).toBe(true);
    }
  });

  it("reserves the first path segment of every nav destination (D-013)", () => {
    // /dashboard/analytics does not itself shadow a customer slug, but the
    // vocabulary must stay withheld in case a section is ever promoted to the
    // root — reserving before launch is free, after launch it is breaking.
    for (const item of NAV_ITEMS) {
      const segment = item.href.split("/").filter(Boolean).pop()!;
      expect(RESERVED_SLUGS.has(segment)).toBe(true);
    }
  });

  it("has unique hrefs and labels", () => {
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((i) => i.label)).size).toBe(NAV_ITEMS.length);
  });

  it("marks Dashboard active only on the exact route", () => {
    const dashboard = NAV_ITEMS.find((i) => i.href === "/dashboard")!;
    expect(dashboard.match("/dashboard")).toBe(true);
    // Otherwise every section would light up Dashboard as well.
    expect(dashboard.match("/dashboard/profiles")).toBe(false);
    expect(dashboard.match("/dashboard/billing")).toBe(false);
  });

  it("keeps a section active on its nested routes", () => {
    const profiles = NAV_ITEMS.find((i) => i.href === "/dashboard/profiles")!;
    expect(profiles.match("/dashboard/profiles")).toBe(true);
    expect(profiles.match("/dashboard/profiles/abc-123/edit")).toBe(true);
    expect(profiles.match("/dashboard/devices")).toBe(false);
  });

  it("marks exactly one section active for any dashboard route", () => {
    const routes = [
      "/dashboard",
      "/dashboard/profiles",
      "/dashboard/profiles/abc/edit",
      "/dashboard/profiles/abc/analytics",
      "/dashboard/devices",
      "/dashboard/analytics",
      "/dashboard/customers",
      "/dashboard/billing",
      "/dashboard/settings",
    ];
    for (const route of routes) {
      const active = NAV_ITEMS.filter((i) => i.match(route));
      expect(active, `${route} matched ${active.map((a) => a.label).join(", ")}`).toHaveLength(1);
    }
  });

  it("does not advertise features that do not exist (CLAUDE.md §13)", () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(labels).not.toContain("Team");
    expect(labels).not.toContain("Notifications");
  });
});
