import { describe, it, expect } from "vitest";
import {
  isLeadStatus,
  parseLeadStatus,
  leadDisplayName,
  whatsappNumber,
  contactChannels,
  matchesQuery,
  parseLeadRange,
  LEAD_STATUSES,
  STATUS_META,
  type Lead,
} from "./leads";

const lead: Lead = {
  id: "l1",
  smart_page_id: "p1",
  page_title: "Java House Westlands",
  page_slug: "java-house",
  name: "Amina Wanjiru",
  phone: "0712345678",
  email: "amina@example.co.ke",
  company: "Wanjiru Ltd",
  message: "Do you cater for events?",
  status: "new",
  note: null,
  created_at: "2026-08-10T09:00:00Z",
  updated_at: null,
  repeat_count: 0,
};

describe("status vocabulary", () => {
  it("accepts only known statuses", () => {
    for (const s of LEAD_STATUSES) expect(isLeadStatus(s)).toBe(true);
    expect(isLeadStatus("archived")).toBe(false);
    expect(isLeadStatus(undefined)).toBe(false);
    expect(isLeadStatus(null)).toBe(false);
  });

  it("parses a status filter, ignoring junk", () => {
    expect(parseLeadStatus("won")).toBe("won");
    expect(parseLeadStatus("nonsense")).toBeUndefined();
    expect(parseLeadStatus("'; drop table leads")).toBeUndefined();
  });

  it("describes every status", () => {
    for (const s of LEAD_STATUSES) {
      expect(STATUS_META[s].label.length).toBeGreaterThan(0);
      expect(STATUS_META[s].description.length).toBeGreaterThan(0);
    }
  });
});

describe("leadDisplayName", () => {
  it("prefers the name", () => {
    expect(leadDisplayName(lead)).toBe("Amina Wanjiru");
  });

  it("falls back through phone, email and company", () => {
    expect(leadDisplayName({ ...lead, name: null })).toBe("0712345678");
    expect(leadDisplayName({ ...lead, name: null, phone: null })).toBe("amina@example.co.ke");
    expect(leadDisplayName({ name: null, phone: null, email: null, company: "Acme" })).toBe("Acme");
  });

  it("never renders an empty heading", () => {
    expect(leadDisplayName({ name: "  ", phone: null, email: null, company: null })).toBe(
      "Unnamed enquiry",
    );
  });
});

describe("whatsappNumber", () => {
  /**
   * Kenyan lead forms are filled in with local 07…/01… numbers. Passing those
   * to wa.me unchanged produces a dead link, which is the whole point of the
   * WhatsApp action.
   */
  it("converts local Kenyan numbers to international form", () => {
    expect(whatsappNumber("0712345678")).toBe("254712345678");
    expect(whatsappNumber("0112345678")).toBe("254112345678");
  });

  it("accepts numbers already in international form", () => {
    expect(whatsappNumber("+254712345678")).toBe("254712345678");
    expect(whatsappNumber("254 712 345 678")).toBe("254712345678");
  });

  it("expands a bare nine-digit mobile", () => {
    expect(whatsappNumber("712345678")).toBe("254712345678");
  });

  it("passes plausible foreign numbers through rather than mangling them", () => {
    expect(whatsappNumber("+44 7700 900123")).toBe("447700900123");
  });

  it("returns null when there is nothing usable", () => {
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber("abc")).toBeNull();
    expect(whatsappNumber("12345")).toBeNull();
  });
});

describe("contactChannels", () => {
  it("offers call, WhatsApp and email when all are available", () => {
    expect(contactChannels(lead).map((c) => c.kind)).toEqual(["call", "whatsapp", "email"]);
  });

  it("offers nothing when the submission left no way to reply", () => {
    expect(contactChannels({ phone: null, email: null })).toEqual([]);
  });

  it("builds usable hrefs", () => {
    const channels = contactChannels(lead);
    expect(channels.find((c) => c.kind === "call")?.href).toBe("tel:0712345678");
    expect(channels.find((c) => c.kind === "whatsapp")?.href).toBe(
      "https://wa.me/254712345678",
    );
    expect(channels.find((c) => c.kind === "email")?.href).toBe(
      "mailto:amina@example.co.ke",
    );
  });
});

describe("matchesQuery", () => {
  it("matches across name, phone, email, company, message and profile", () => {
    expect(matchesQuery(lead, "amina")).toBe(true);
    expect(matchesQuery(lead, "0712")).toBe(true);
    expect(matchesQuery(lead, "cater")).toBe(true);
    expect(matchesQuery(lead, "westlands")).toBe(true);
  });

  it("is case and whitespace insensitive", () => {
    expect(matchesQuery(lead, "  AMINA  ")).toBe(true);
  });

  it("matches everything on an empty query", () => {
    expect(matchesQuery(lead, "")).toBe(true);
    expect(matchesQuery(lead, "   ")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesQuery(lead, "nairobi hospital")).toBe(false);
  });

  it("copes with a sparse submission", () => {
    const sparse = { ...lead, name: null, email: null, company: null, message: null };
    expect(matchesQuery(sparse, "0712")).toBe(true);
    expect(matchesQuery(sparse, "amina")).toBe(false);
  });
});

describe("parseLeadRange", () => {
  it("accepts the supported windows and defaults to 90 days", () => {
    expect(parseLeadRange("30")).toBe(30);
    expect(parseLeadRange("365")).toBe(365);
    expect(parseLeadRange(undefined)).toBe(90);
    expect(parseLeadRange("7")).toBe(90);
    expect(parseLeadRange("junk")).toBe(90);
  });
});
