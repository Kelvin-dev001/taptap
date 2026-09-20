import { describe, it, expect } from "vitest";
import {
  isValidSerial,
  normalizeSerial,
  formatSerial,
  variantFromSerial,
  parseScan,
  tokenFromUrl,
  batchCsv,
  qrUrlFor,
  chipUrlFor,
  inStockFor,
  lowStockVariants,
  STOCK_STATES,
  STOCK_STATE_META,
  LOW_STOCK_THRESHOLD,
  isProductionSiteUrl,
  chipWriteMatches,
  encodeBlockedReason,
} from "./stock";

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const SITE = "https://taptap.hornbilltech.co.ke";

describe("serials", () => {
  it("formats with a variant prefix and six digits", () => {
    expect(formatSerial("standard", 123)).toBe("S-000123");
    expect(formatSerial("premium", 45)).toBe("P-000045");
  });

  it("accepts a serial typed in lower case or with stray spaces", () => {
    expect(normalizeSerial("  s-000123 ")).toBe("S-000123");
    expect(isValidSerial("s-000123")).toBe(true);
    expect(isValidSerial(" P-000045")).toBe(true);
  });

  it("refuses anything that is not a serial", () => {
    expect(isValidSerial("S-12345")).toBe(false);
    expect(isValidSerial("X-000123")).toBe(false);
    expect(isValidSerial("S000123")).toBe(false);
    expect(isValidSerial(TOKEN)).toBe(false);
    expect(isValidSerial("")).toBe(false);
    expect(isValidSerial(null)).toBe(false);
  });

  /**
   * A Premium blank and a Standard card are identical from the back. The prefix
   * is the only thing telling staff which they are holding.
   */
  it("says which SKU a serial belongs to", () => {
    expect(variantFromSerial("S-000001")).toBe("standard");
    expect(variantFromSerial("P-000001")).toBe("premium");
    expect(variantFromSerial("nonsense")).toBeNull();
  });

  /**
   * The serial is printed on a card that sits in a display case. It must say
   * nothing about where the card points — anyone who reads one off the plastic
   * learns a label, not a capability.
   */
  it("carries nothing derivable from a token", () => {
    expect(formatSerial("standard", 123)).not.toContain(TOKEN.slice(0, 6));
    expect(formatSerial("standard", 123)).toHaveLength(8);
  });
});

/**
 * Three things arrive at the assign box and all three are legitimate: a URL from
 * the camera, a bare token from an NDEF read, and a serial typed by hand.
 */
describe("parseScan", () => {
  it("reads a bare token", () => {
    expect(parseScan(TOKEN)).toEqual({ kind: "token", token: TOKEN });
    expect(parseScan(`  ${TOKEN}  `)).toEqual({ kind: "token", token: TOKEN });
    expect(parseScan(TOKEN.toUpperCase())).toEqual({ kind: "token", token: TOKEN });
  });

  it("reads a serial", () => {
    expect(parseScan("S-000123")).toEqual({ kind: "serial", serial: "S-000123" });
    expect(parseScan("p-000045")).toEqual({ kind: "serial", serial: "P-000045" });
  });

  /** The printed QR carries ?src=qr so the scan is attributed correctly. */
  it("reads the URL the printed QR actually encodes", () => {
    expect(parseScan(`${SITE}/t/${TOKEN}?src=qr`)).toEqual({ kind: "token", token: TOKEN });
  });

  it("reads the plain URL the chip is encoded with", () => {
    expect(parseScan(`${SITE}/t/${TOKEN}`)).toEqual({ kind: "token", token: TOKEN });
  });

  it("tolerates a trailing slash, a fragment and extra query parameters", () => {
    expect(parseScan(`${SITE}/t/${TOKEN}/`)).toEqual({ kind: "token", token: TOKEN });
    expect(parseScan(`${SITE}/t/${TOKEN}#x`)).toEqual({ kind: "token", token: TOKEN });
    expect(parseScan(`${SITE}/t/${TOKEN}?src=qr&utm_source=x`)).toEqual({
      kind: "token",
      token: TOKEN,
    });
  });

  /**
   * A scan can arrive without a scheme, which `new URL` rejects outright. Real
   * cards would be unassignable if this depended on one.
   */
  it("reads a URL with no scheme", () => {
    expect(parseScan(`taptap.hornbilltech.co.ke/t/${TOKEN}`)).toEqual({
      kind: "token",
      token: TOKEN,
    });
  });

  /**
   * The host is deliberately not checked. A card printed before the domain moved
   * is still a real card, and refusing it would strand plastic for no gain in
   * safety: what identifies a card is the token, which is validated on its own.
   */
  it("accepts a card printed against a different host", () => {
    expect(parseScan(`https://old-domain.example/t/${TOKEN}`)).toEqual({
      kind: "token",
      token: TOKEN,
    });
  });

  it("refuses what it does not recognise", () => {
    expect(parseScan("https://example.com/")).toEqual({ kind: "unknown" });
    expect(parseScan(`${SITE}/t/not-a-token`)).toEqual({ kind: "unknown" });
    expect(parseScan(`${SITE}/some-slug`)).toEqual({ kind: "unknown" });
    expect(parseScan("")).toEqual({ kind: "unknown" });
    expect(parseScan(null)).toEqual({ kind: "unknown" });
  });

  /** A token of the wrong length is not a token, however URL-shaped it looks. */
  it("refuses a token that is the wrong length", () => {
    expect(parseScan(`${SITE}/t/${TOKEN.slice(0, 31)}`)).toEqual({ kind: "unknown" });
    expect(parseScan(`${SITE}/t/${TOKEN}ff`)).toEqual({ kind: "unknown" });
  });

  it("finds the token even when the path is nested", () => {
    expect(tokenFromUrl(`${SITE}/preview/t/${TOKEN}`)).toBe(TOKEN);
  });

  it("returns nothing for a /t path with no token after it", () => {
    expect(tokenFromUrl(`${SITE}/t`)).toBeNull();
    expect(tokenFromUrl(`${SITE}/t/`)).toBeNull();
  });
});

describe("what the supplier prints", () => {
  /**
   * The QR carries `?src=qr` and the chip does not. That single difference is
   * the whole of how a scan is told apart from a tap: without it every QR scan
   * would be counted as NFC engagement we never had, which §15 forbids.
   */
  it("marks the printed QR as a QR and leaves the chip plain", () => {
    expect(qrUrlFor(SITE, TOKEN)).toBe(`${SITE}/t/${TOKEN}?src=qr`);
    expect(chipUrlFor(SITE, TOKEN)).toBe(`${SITE}/t/${TOKEN}`);
    expect(chipUrlFor(SITE, TOKEN)).not.toContain("src=");
  });

  it("builds one row per card with the QR the supplier must encode", () => {
    const csv = batchCsv("B-2026-01", [
      { serial: "S-000001", variant: "standard", token: TOKEN },
    ], SITE);

    const [header, row] = csv.split("\r\n");
    expect(header).toBe("batch,serial,variant,qr_url");
    expect(row).toBe(`B-2026-01,S-000001,standard,${SITE}/t/${TOKEN}?src=qr`);
  });

  /** A legacy card has no printed serial. The row must still be well formed. */
  it("leaves an empty cell rather than the word null", () => {
    const csv = batchCsv("LEGACY", [{ serial: null, variant: null, token: TOKEN }], SITE);
    expect(csv.split("\r\n")[1]).toBe(`LEGACY,,,${SITE}/t/${TOKEN}?src=qr`);
  });
});

describe("counting the shelf", () => {
  const counts = [
    { variant: "standard", state: "in_stock", count: 40 },
    { variant: "standard", state: "allocated", count: 120 },
    { variant: "premium", state: "in_stock", count: 4 },
    { variant: "premium", state: "received", count: 200 },
  ];

  it("counts only what is sellable", () => {
    expect(inStockFor(counts, "standard")).toBe(40);
    expect(inStockFor(counts, "premium")).toBe(4);
    expect(inStockFor(counts, "nonexistent")).toBe(0);
    expect(inStockFor(null, "standard")).toBe(0);
  });

  /**
   * `received` cards have blank chips and cannot fill an order. Counting them
   * would report a shelf full of cards nobody can send — which is exactly the
   * moment a low-stock warning needs to fire, not stay quiet.
   */
  it("does not count unencoded cards as stock", () => {
    expect(lowStockVariants(counts).map((v) => v.variant)).toContain("premium");
    expect(inStockFor(counts, "premium")).toBe(4);
  });

  it("reports the scarcest variant first", () => {
    const low = lowStockVariants([
      { variant: "standard", state: "in_stock", count: 9 },
      { variant: "premium", state: "in_stock", count: 2 },
    ]);
    expect(low.map((v) => v.variant)).toEqual(["premium", "standard"]);
  });

  it("says nothing while both variants are healthy", () => {
    expect(
      lowStockVariants([
        { variant: "standard", state: "in_stock", count: 50 },
        { variant: "premium", state: "in_stock", count: 50 },
      ]),
    ).toEqual([]);
  });

  it("uses a threshold that leaves time to reorder", () => {
    expect(LOW_STOCK_THRESHOLD).toBeGreaterThan(0);
  });
});

describe("stock states", () => {
  /** Non-colour status communication is a WCAG 2.2 requirement (§24). */
  it("gives every state a label and a description", () => {
    for (const state of STOCK_STATES) {
      expect(STOCK_STATE_META[state].label.length).toBeGreaterThan(0);
      expect(STOCK_STATE_META[state].description.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Encoding (Sprint 8b)
// ---------------------------------------------------------------------------

/**
 * The guard that stands between a workshop phone and a drawer of dead cards.
 *
 * Locking is irreversible. A chip written from localhost or a preview
 * deployment carries that URL for the life of the card and looks perfectly fine
 * until a customer taps it. Every case below is a card nobody could have fixed.
 */
describe("isProductionSiteUrl", () => {
  it("accepts the live site over HTTPS", () => {
    expect(isProductionSiteUrl("https://taptap.hornbilltech.co.ke")).toBe(true);
    expect(isProductionSiteUrl("https://taptap.hornbilltech.co.ke/")).toBe(true);
    expect(isProductionSiteUrl("https://TapTap.HornbillTech.co.ke")).toBe(true);
  });

  it("refuses localhost, which is where this would otherwise be tested", () => {
    expect(isProductionSiteUrl("http://localhost:3000")).toBe(false);
    expect(isProductionSiteUrl("https://localhost:3000")).toBe(false);
    expect(isProductionSiteUrl("http://127.0.0.1:3000")).toBe(false);
  });

  it("refuses preview deployments", () => {
    expect(isProductionSiteUrl("https://taptap-3irf5bf1n-kelvins-projects.vercel.app")).toBe(false);
    expect(isProductionSiteUrl("https://taptap-omega.vercel.app")).toBe(false);
  });

  /** A subdomain is not the site, however much of the name it shares. */
  it("refuses anything that merely ends with the right string", () => {
    expect(isProductionSiteUrl("https://staging.taptap.hornbilltech.co.ke")).toBe(false);
    expect(isProductionSiteUrl("https://evil-taptap.hornbilltech.co.ke.attacker.com")).toBe(false);
    expect(isProductionSiteUrl("https://hornbilltech.co.ke")).toBe(false);
  });

  it("refuses plain HTTP even on the right host", () => {
    expect(isProductionSiteUrl("http://taptap.hornbilltech.co.ke")).toBe(false);
  });

  it("refuses nonsense rather than throwing", () => {
    expect(isProductionSiteUrl("")).toBe(false);
    expect(isProductionSiteUrl(null)).toBe(false);
    expect(isProductionSiteUrl(undefined)).toBe(false);
    expect(isProductionSiteUrl("not a url")).toBe(false);
    expect(isProductionSiteUrl("taptap.hornbilltech.co.ke")).toBe(false);
  });
});

/**
 * Read-back is the only thing standing between a bad write and a locked bad
 * card, so it compares exactly. Anything cleverer would be this function
 * deciding that a difference does not matter.
 */
describe("chipWriteMatches", () => {
  const url = "https://taptap.hornbilltech.co.ke/t/abc123";

  it("accepts an identical read-back, and tolerates surrounding whitespace", () => {
    expect(chipWriteMatches(url, url)).toBe(true);
    expect(chipWriteMatches(url, `  ${url}\n`)).toBe(true);
  });

  it("refuses a truncated write, which is what a bad chip actually produces", () => {
    expect(chipWriteMatches(url, "https://taptap.hornbilltech.co.ke/t/abc")).toBe(false);
  });

  it("refuses another card's token", () => {
    expect(chipWriteMatches(url, "https://taptap.hornbilltech.co.ke/t/zzz999")).toBe(false);
  });

  it("refuses the QR variant, which is a different URL", () => {
    expect(chipWriteMatches(url, `${url}?src=qr`)).toBe(false);
  });

  it("refuses an empty or missing read", () => {
    expect(chipWriteMatches(url, "")).toBe(false);
    expect(chipWriteMatches(url, null)).toBe(false);
    expect(chipWriteMatches(url, undefined)).toBe(false);
  });
});

/**
 * Mirrors `encode_card`'s refusals (0027) so the page can explain the situation
 * before anyone holds a card to a phone. The database stays the enforcement.
 */
describe("encodeBlockedReason", () => {
  it("allows a received card, which is the only encodable state", () => {
    expect(encodeBlockedReason({ stock_state: "received" })).toBeNull();
  });

  it("refuses a card that has not physically arrived", () => {
    expect(encodeBlockedReason({ stock_state: "at_supplier" })).toMatch(/received/i);
  });

  it("refuses one that is already encoded", () => {
    expect(encodeBlockedReason({ stock_state: "in_stock" })).toMatch(/already encoded/i);
  });

  /** Re-encoding a card somebody has bought would break a working card. */
  it("refuses one that is on an order", () => {
    expect(encodeBlockedReason({ stock_state: "allocated" })).toMatch(/already on an order/i);
  });

  it("refuses a written-off chip", () => {
    expect(encodeBlockedReason({ stock_state: "defective" })).toMatch(/defective/i);
  });

  /** A placeholder token is never printed and never encoded (D-026). */
  it("refuses a placeholder identity whatever its stock state", () => {
    expect(encodeBlockedReason({ stock_state: "received", is_placeholder: true })).toMatch(
      /placeholder/i,
    );
  });

  it("refuses a stand, which is encoded from its order", () => {
    expect(encodeBlockedReason({ stock_state: "received", kind: "stand" })).toMatch(/stand/i);
  });

  it("refuses a card with no stock state at all", () => {
    expect(encodeBlockedReason({ stock_state: null })).not.toBeNull();
    expect(encodeBlockedReason({})).not.toBeNull();
  });
});
