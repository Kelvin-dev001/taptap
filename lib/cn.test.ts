import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("lets a later Tailwind utility win over a conflicting earlier one", () => {
    // This is what allows every component to accept a className override.
    expect(cn("px-3 py-2", "px-5")).toBe("py-2 px-5");
    expect(cn("rounded-lg", "rounded-full")).toBe("rounded-full");
  });

  it("keeps non-conflicting utilities", () => {
    expect(cn("text-body-sm font-medium", "text-foreground")).toBe(
      "text-body-sm font-medium text-foreground",
    );
  });

  // Regression: tailwind-merge does not know our custom type scale by default
  // and collapsed size + colour into one group, dropping the size.
  it("treats a custom font size and a text colour as separate groups", () => {
    expect(cn("text-metric", "text-muted")).toBe("text-metric text-muted");
    expect(cn("text-card-title text-foreground")).toBe("text-card-title text-foreground");
  });

  it("still lets one custom font size override another", () => {
    expect(cn("text-body", "text-metric")).toBe("text-metric");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });
});
