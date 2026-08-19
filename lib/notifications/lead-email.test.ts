import { describe, it, expect } from "vitest";
import { composeLeadEmail, escapeHtml } from "./lead-email";

const base = {
  businessName: "Magangi and Company",
  slug: "mac-stephen",
  pageTitle: "Stephen Nyakwara Magangi",
  siteUrl: "https://taptap.hornbilltech.co.ke",
};

const fullLead = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Asha Kimani",
  phone: "0722123456",
  email: "asha@example.co.ke",
  company: "Kimani Traders",
  message: "Need help with 2025 tax returns.",
};

describe("escapeHtml", () => {
  it("escapes every character that could open a tag or attribute", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;",
    );
  });

  it("escapes the ampersand first so entities are not double-broken", () => {
    expect(escapeHtml("Tom & <Jerry>")).toBe("Tom &amp; &lt;Jerry&gt;");
  });
});

describe("composeLeadEmail", () => {
  it("names the lead and the business in the subject", () => {
    const { subject } = composeLeadEmail({ ...base, lead: fullLead });
    expect(subject).toBe("New lead for Magangi and Company: Asha Kimani");
  });

  /**
   * The whole point of the sprint: the details are IN the message, so an owner
   * on a phone can act without signing in to anything.
   */
  it("includes every detail the customer submitted", () => {
    const { text, html } = composeLeadEmail({ ...base, lead: fullLead });
    for (const value of [
      "Asha Kimani",
      "0722123456",
      "asha@example.co.ke",
      "Kimani Traders",
      "Need help with 2025 tax returns.",
    ]) {
      expect(text).toContain(value);
      expect(html).toContain(value);
    }
  });

  it("offers call and WhatsApp actions in international format", () => {
    const { text, html } = composeLeadEmail({ ...base, lead: fullLead });
    // Same rule as lib/blocks.ts — wa.me rejects a leading zero.
    expect(text).toContain("https://wa.me/254722123456");
    expect(html).toContain("https://wa.me/254722123456");
    expect(html).toContain('href="tel:+254722123456"');
    expect(html).not.toMatch(/wa\.me\/0/);
  });

  it("says which profile the lead came through", () => {
    const { text } = composeLeadEmail({ ...base, lead: fullLead });
    expect(text).toContain("Stephen Nyakwara Magangi");
  });

  it("falls back to the slug when the profile has no title", () => {
    const { text } = composeLeadEmail({ ...base, pageTitle: null, lead: fullLead });
    expect(text).toContain("/mac-stephen");
  });

  /** An empty "Phone: —" wastes the most valuable line of a phone preview. */
  it("omits fields the customer left blank", () => {
    const { text, html } = composeLeadEmail({
      ...base,
      lead: { id: "x", name: "Asha Kimani", phone: null, email: null, message: null },
    });
    expect(text).not.toContain("Phone:");
    expect(text).not.toContain("Message:");
    // Matched as a row label, not a bare substring: the business name is
    // "Magangi and Company", so `toContain("Company")` would always pass.
    expect(html).not.toContain(">Company</td>");
    expect(html).toContain(">Name</td>");
  });

  it("drops the action buttons entirely when there is nothing to act on", () => {
    const { html } = composeLeadEmail({ ...base, lead: { id: "x", name: "Asha Kimani" } });
    expect(html).not.toContain("href=\"tel:");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("mailto:");
  });

  it("still identifies an anonymous lead by whatever it has", () => {
    const phoneOnly = composeLeadEmail({
      ...base,
      lead: { id: "x", name: null, phone: "0722123456" },
    });
    expect(phoneOnly.subject).toContain("0722123456");

    const nothing = composeLeadEmail({ ...base, lead: { id: "x" } });
    expect(nothing.subject).toContain("Someone");
  });

  /**
   * The message is written by an anonymous member of the public and lands in
   * the owner's mail client as HTML. Escaping is the only thing between those
   * two facts.
   */
  it("escapes hostile input in the HTML body", () => {
    const { html } = composeLeadEmail({
      ...base,
      lead: { id: "x", name: "<img src=x onerror=alert(1)>", message: "<script>bad()</script>" },
    });
    expect(html).not.toContain("<script>bad()</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes hostile input in the subject-bearing name too", () => {
    const { html } = composeLeadEmail({
      ...base,
      businessName: 'Evil" onmouseover="x',
      lead: fullLead,
    });
    expect(html).not.toContain('onmouseover="x"');
  });

  it("links back to the leads screen without a double slash", () => {
    const { text } = composeLeadEmail({
      ...base,
      siteUrl: "https://taptap.hornbilltech.co.ke/",
      lead: fullLead,
    });
    expect(text).toContain("https://taptap.hornbilltech.co.ke/dashboard/customers");
    expect(text).not.toContain(".co.ke//dashboard");
  });

  it("tells the owner how to turn it off", () => {
    const { html } = composeLeadEmail({ ...base, lead: fullLead });
    expect(html).toContain("Notifications");
  });
});
