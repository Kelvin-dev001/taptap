import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PrivacyPage from "./privacy/page";
import TermsPage from "./terms/page";

/**
 * The legal pages carried `[bracketed]` placeholders from Sprint 5 until
 * 2026-08-31, and they were item §5 on the launch checklist the whole time.
 *
 * They are easy to forget precisely because nothing errors: a page reading
 * "operated by [Hornbill legal entity name]" renders perfectly and is only
 * embarrassing to a human who reads it. The landing page now links to both from
 * the footer and the FAQ, so they get real traffic.
 *
 * These assert the two things a reader has to be able to find: who is
 * responsible, and how to reach them.
 */
const PAGES: [string, () => React.ReactElement][] = [
  ["privacy", () => <PrivacyPage />],
  ["terms", () => <TermsPage />],
];

describe("legal pages", () => {
  it.each(PAGES)("%s has no unfilled placeholder", (_name, page) => {
    const { container } = render(page());
    const text = container.textContent ?? "";
    // A square bracket in prose is always a placeholder here; neither page has
    // any legitimate reason to use one.
    expect(text).not.toMatch(/\[[^\]]+\]/);
  });

  it.each(PAGES)("%s names a way to contact us", (_name, page) => {
    const { container } = render(page());
    expect(container.textContent ?? "").toContain("info@hornbilltech.co.ke");
  });

  it("names the data controller in full", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("Hornbill Technologies Limited");
    expect(text).toContain("data controller");
    // The regulator a complaint would actually go to.
    expect(text).toContain("ODPC");
  });

  it("offers a working phone link, not just a number to copy", () => {
    const { container } = render(<PrivacyPage />);
    const tel = container.querySelector('a[href^="tel:"]');
    expect(tel?.getAttribute("href")).toBe("tel:+254759293030");
  });
});
