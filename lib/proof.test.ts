import { describe, it, expect } from "vitest";
import {
  proofFieldsFromPage,
  fitProof,
  proofSnapshot,
  snapshotDiffers,
  approvalBlockedReason,
  isProofStatus,
  PROOF_STATUSES,
  PROOF_STATUS_META,
  CR80_WIDTH_MM,
  CR80_HEIGHT_MM,
  PRINT_WIDTH_PX,
  PRINT_HEIGHT_PX,
  type ProofFields,
} from "./proof";

const fields: ProofFields = {
  name: "Magangi & Company",
  title: "Certified Public Accountants",
  org: null,
  logoUrl: "https://example.com/logo.png",
  accent: "#C2560A",
};

/**
 * The card is a physical object with a fixed size, and the print output has to
 * match it exactly or the printer crops somebody's name.
 */
describe("CR80 geometry", () => {
  it("is the bank-card size every ID printer expects", () => {
    expect(CR80_WIDTH_MM).toBe(85.6);
    expect(CR80_HEIGHT_MM).toBe(54);
  });

  /** 85.6mm ÷ 25.4 × 300 = 1011. If this drifts, the PNG stops being 300dpi. */
  it("matches 300dpi in pixels", () => {
    expect(PRINT_WIDTH_PX).toBe(Math.round((CR80_WIDTH_MM / 25.4) * 300));
    expect(PRINT_HEIGHT_PX).toBe(Math.round((CR80_HEIGHT_MM / 25.4) * 300));
  });

  it("keeps the print aspect ratio within a pixel of the physical card", () => {
    const physical = CR80_WIDTH_MM / CR80_HEIGHT_MM;
    const printed = PRINT_WIDTH_PX / PRINT_HEIGHT_PX;
    expect(Math.abs(physical - printed)).toBeLessThan(0.005);
  });
});

describe("proofFieldsFromPage", () => {
  it("takes the name from the page title and the title from the contact", () => {
    const f = proofFieldsFromPage({
      title: "Magangi & Company",
      config: { contact: { title: "Certified Public Accountants" } },
      theme: { accent: "#C2560A" },
    });
    expect(f.name).toBe("Magangi & Company");
    expect(f.title).toBe("Certified Public Accountants");
    expect(f.accent).toBe("#C2560A");
  });

  it("falls back to the tagline when there is no contact title", () => {
    const f = proofFieldsFromPage({ title: "Kreto", config: { tagline: "Coffee, Westlands" } });
    expect(f.title).toBe("Coffee, Westlands");
  });

  /** A card reading the same words twice looks like a mistake, because it is. */
  it("drops the org when it merely repeats the name", () => {
    expect(
      proofFieldsFromPage({
        title: "Kreto",
        config: { contact: { org: "Kreto" } },
      }).org,
    ).toBeNull();
    expect(
      proofFieldsFromPage({
        title: "Kreto",
        config: { contact: { org: "kreto" } },
      }).org,
    ).toBeNull();
  });

  it("keeps an org that genuinely differs", () => {
    expect(
      proofFieldsFromPage({
        title: "Jane Wanjiku",
        config: { contact: { org: "Kreto Ltd" } },
      }).org,
    ).toBe("Kreto Ltd");
  });

  it("falls back to the default accent rather than rendering an empty colour", () => {
    expect(proofFieldsFromPage({ title: "X" }).accent).toBe("#111827");
    expect(proofFieldsFromPage({ title: "X", theme: { accent: "  " } }).accent).toBe("#111827");
  });

  it("survives a page with nothing on it", () => {
    const f = proofFieldsFromPage({});
    expect(f.name).toBe("");
    expect(f.title).toBeNull();
    expect(f.logoUrl).toBeNull();
  });
});

/**
 * Text fitting is the whole reason this is a fixed template rather than a
 * designer. It has to be deterministic, because the same answer has to come out
 * in the browser preview, the print page and Satori.
 */
describe("fitProof", () => {
  it("uses the largest size for a short name", () => {
    const fitted = fitProof({ ...fields, name: "Kreto" });
    expect(fitted.name.size).toBe(46);
    expect(fitted.name.truncated).toBe(false);
  });

  it("steps the size down as the name grows, rather than overflowing", () => {
    const short = fitProof({ ...fields, name: "Kreto" }).name.size;
    const medium = fitProof({ ...fields, name: "Magangi & Company" }).name.size;
    const long = fitProof({ ...fields, name: "Magangi & Company Certified Accountants" }).name.size;
    expect(medium).toBeLessThan(short);
    expect(long).toBeLessThan(medium);
  });

  it("truncates only when even the smallest size will not hold it", () => {
    const fitted = fitProof({ ...fields, name: "A".repeat(200) });
    expect(fitted.name.truncated).toBe(true);
    expect(fitted.name.text.endsWith("…")).toBe(true);
    expect(fitted.name.text.length).toBeLessThanOrEqual(40);
    expect(fitted.anyTruncated).toBe(true);
  });

  /** A long name must not drag a short title down with it. */
  it("sizes each line independently", () => {
    const fitted = fitProof({
      ...fields,
      name: "Magangi & Company Certified Accountants",
      title: "CPA",
    });
    expect(fitted.name.size).toBeLessThan(46);
    expect(fitted.title?.size).toBe(22);
  });

  it("collapses whitespace rather than rendering it", () => {
    expect(fitProof({ ...fields, name: "  Kreto   Ltd  " }).name.text).toBe("Kreto Ltd");
  });

  it("omits lines that have no content", () => {
    const fitted = fitProof({ ...fields, title: null, org: null });
    expect(fitted.title).toBeNull();
    expect(fitted.org).toBeNull();
  });

  /** An empty profile still has to produce something printable. */
  it("never renders an empty name", () => {
    expect(fitProof({ ...fields, name: "" }).name.text).toBe("Untitled");
  });

  it("reports truncation so the UI can warn before printing", () => {
    expect(fitProof({ ...fields, name: "Kreto" }).anyTruncated).toBe(false);
    expect(fitProof({ ...fields, title: "x".repeat(100) }).anyTruncated).toBe(true);
  });
});

/**
 * The snapshot is what stops a card changing after it was approved. If this
 * stops working, somebody approves one card and receives a different one.
 */
describe("proofSnapshot", () => {
  it("captures every printed field plus where it came from", () => {
    const snap = proofSnapshot("page-1", fields);
    expect(snap).toMatchObject({ ...fields, pageId: "page-1", version: 1 });
  });

  it("notices a profile edited after approval", () => {
    const snap = proofSnapshot("page-1", fields);
    expect(snapshotDiffers(snap, fields)).toBe(false);
    expect(snapshotDiffers(snap, { ...fields, name: "Something Else" })).toBe(true);
    expect(snapshotDiffers(snap, { ...fields, accent: "#000000" })).toBe(true);
    expect(snapshotDiffers(snap, { ...fields, logoUrl: null })).toBe(true);
  });

  it("treats a missing snapshot as nothing to compare", () => {
    expect(snapshotDiffers(null, fields)).toBe(false);
    expect(snapshotDiffers(undefined, fields)).toBe(false);
  });
});

/**
 * A card must work when it arrives. Printing a name onto plastic that opens a
 * draft nobody can see is a card that is dead on delivery (D-021).
 */
describe("approvalBlockedReason", () => {
  it("allows approval of a chosen, published profile", () => {
    expect(
      approvalBlockedReason({
        proof_status: "awaiting_approval",
        proof_page_id: "p1",
        pagePublished: true,
      }),
    ).toBeNull();
  });

  it("refuses until a profile is chosen", () => {
    expect(approvalBlockedReason({ proof_status: "pending", proof_page_id: null })).toMatch(
      /choose which profile/i,
    );
  });

  it("refuses an unpublished profile, and says why it matters", () => {
    const reason = approvalBlockedReason({
      proof_status: "awaiting_approval",
      proof_page_id: "p1",
      pagePublished: false,
    });
    expect(reason).toMatch(/publish/i);
    expect(reason).toMatch(/arrives dead/i);
  });

  it("refuses to approve twice", () => {
    expect(
      approvalBlockedReason({ proof_status: "approved", proof_page_id: "p1", pagePublished: true }),
    ).toMatch(/already approved/i);
  });
});

describe("proof status", () => {
  it("matches the database check constraint from 0022", () => {
    expect(PROOF_STATUSES).toEqual([
      "pending",
      "awaiting_approval",
      "approved",
      "revision_requested",
    ]);
  });

  it("recognises only those", () => {
    expect(isProofStatus("approved")).toBe(true);
    expect(isProofStatus("printed")).toBe(false);
    expect(isProofStatus(null)).toBe(false);
  });

  it("has copy for staff and for the customer in every state", () => {
    for (const s of PROOF_STATUSES) {
      expect(PROOF_STATUS_META[s].label.length).toBeGreaterThan(0);
      expect(PROOF_STATUS_META[s].customerLabel.length).toBeGreaterThan(0);
      expect(PROOF_STATUS_META[s].description).not.toContain("—");
    }
  });
});
