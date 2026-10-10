import { emailLinkTo } from "./email-codes";

// Hoisted above the import by babel-jest.
jest.mock("@/api/supabase", () => ({ supabase: {} }));
jest.mock("@/config/env", () => ({ env: { siteUrl: "https://taptap.hornbilltech.co.ke" } }));

/**
 * The email templates pass this redirect to /auth/confirm as `redirect_to`, and
 * the website reads `next` back out of it (lib/email-link.ts). The shape is a
 * contract between the app, the templates and the website.
 */
describe("emailLinkTo", () => {
  it("points at the website's confirm page with an encoded next", () => {
    expect(emailLinkTo("/dashboard")).toBe(
      "https://taptap.hornbilltech.co.ke/auth/confirm?next=%2Fdashboard",
    );
    expect(emailLinkTo("/reset-password")).toBe(
      "https://taptap.hornbilltech.co.ke/auth/confirm?next=%2Freset-password",
    );
  });

  it("always carries a query string, so nothing appended to it can break the URL", () => {
    expect(new URL(emailLinkTo("/a?b=1&c=2")).searchParams.get("next")).toBe("/a?b=1&c=2");
  });
});
