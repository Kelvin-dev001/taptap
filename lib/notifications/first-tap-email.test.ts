import { describe, it, expect } from "vitest";
import { composeFirstTapEmail, type FirstTapEmailInput } from "./first-tap-email";

const base: FirstTapEmailInput = {
  businessName: "Magangi & Company",
  orderNumber: "TT012",
  quantity: 1,
  productName: "Standard Card",
  slug: "magangi",
  siteUrl: "https://taptap.hornbilltech.co.ke",
};

/**
 * The email that says the thing they bought has become a product.
 *
 * Its one hard rule is honesty about scale: this fires on ONE tap, and claiming
 * anything more than one tap would be the fabrication §15 forbids — and the
 * customer would catch it at a glance in their own analytics.
 */
describe("composeFirstTapEmail", () => {
  it("claims one tap, never a plural or a trend", () => {
    const text = composeFirstTapEmail(base).text.toLowerCase();
    expect(text).toContain("first time");
    expect(text).not.toMatch(/taps are|getting taps|\d+ taps/);
  });

  it("names the business and the order", () => {
    const email = composeFirstTapEmail(base);
    expect(email.text).toContain("Magangi & Company");
    expect(email.text).toContain("TT012");
  });

  it("links to the profile and the analytics when there is a profile", () => {
    const email = composeFirstTapEmail(base);
    expect(email.text).toContain("https://taptap.hornbilltech.co.ke/magangi");
    expect(email.text).toContain("https://taptap.hornbilltech.co.ke/dashboard/analytics");
  });

  /**
   * A card can ship without a profile chosen (D-026 lets it). The email must
   * then not invent a link that 404s.
   */
  it("falls back to the dashboard when no profile is linked", () => {
    const email = composeFirstTapEmail({ ...base, slug: null });
    expect(email.text).toContain("https://taptap.hornbilltech.co.ke/dashboard");
    expect(email.text).not.toContain("/null");
    expect(email.text).not.toMatch(/Your profile:/);
  });

  it("treats a blank slug as no slug", () => {
    const email = composeFirstTapEmail({ ...base, slug: "   " });
    expect(email.text).not.toMatch(/Your profile:/);
  });

  it("does not double the slash on a trailing-slash site URL", () => {
    const email = composeFirstTapEmail({ ...base, siteUrl: "https://example.com/" });
    expect(email.text).toContain("https://example.com/magangi");
    expect(email.text).not.toContain("example.com//");
  });

  it("speaks of a card for one and cards for several", () => {
    expect(composeFirstTapEmail(base).subject).toMatch(/card is live/i);
    expect(composeFirstTapEmail({ ...base, quantity: 2 }).subject).toMatch(/cards are live/i);
    expect(composeFirstTapEmail({ ...base, quantity: 2 }).text).toContain("2 ×");
  });

  /** It marks the order delivered, so it has to say so and offer a way back. */
  it("says the order was marked delivered and how to dispute it", () => {
    const text = composeFirstTapEmail(base).text.toLowerCase();
    expect(text).toContain("delivered");
    expect(text).toContain("reply");
  });

  it("escapes what came from a person", () => {
    const email = composeFirstTapEmail({
      ...base,
      businessName: '<script>alert("x")</script>',
    });
    expect(email.html).not.toContain("<script>");
  });

  /** Customer copy. No em dashes. */
  it("uses no em dashes", () => {
    const email = composeFirstTapEmail(base);
    expect(email.subject).not.toContain("—");
    expect(email.text).not.toContain("—");
  });
});
