/**
 * Card stock — serials, scanning, and what the supplier prints from (D-026).
 *
 * Pure, like lib/orders.ts and lib/identity.ts, and for the same reason: what
 * counts as a valid serial and what a scanned QR means are rules that get tuned,
 * and a rule that can only be exercised against a live database is a rule nobody
 * re-checks after changing it.
 */

import { toCsv } from "./csv";
import { isValidToken, tokenUrl } from "./tags";
import type { CardVariant } from "./pricing";

/**
 * Where a card is in the world. Separate from `nfc_tags.status`, which is about
 * the identity — see 0021's axis rule.
 */
export type StockState =
  /** Ordered from the supplier, not in the building. */
  | "at_supplier"
  /** Arrived. Chips are still blank. */
  | "received"
  /** Encoded, locked, tested. On the shelf and sellable. */
  | "in_stock"
  /** Scanned onto somebody's order. */
  | "allocated"
  /** Broken chip, misprint, delaminated. Never sold. */
  | "defective";

export const STOCK_STATES: StockState[] = [
  "at_supplier",
  "received",
  "in_stock",
  "allocated",
  "defective",
];

export const STOCK_STATE_META: Record<
  StockState,
  { label: string; description: string; tone: "info" | "warning" | "success" | "neutral" | "danger" }
> = {
  at_supplier: {
    label: "At supplier",
    description: "Ordered. Not in the building yet",
    tone: "neutral",
  },
  received: {
    label: "Received",
    description: "Arrived. Chips still blank, not sellable",
    tone: "warning",
  },
  in_stock: {
    label: "In stock",
    description: "Encoded and locked. Ready to sell",
    tone: "success",
  },
  allocated: {
    label: "Allocated",
    description: "Scanned onto an order",
    tone: "info",
  },
  defective: {
    label: "Defective",
    description: "Faulty or misprinted. Never sold",
    tone: "danger",
  },
};

/** How few cards of a variant counts as running out. */
export const LOW_STOCK_THRESHOLD = 10;

/** The most plastic one mint commits us to at a time. */
export const MAX_BATCH_QUANTITY = 1_000;

// ---------------------------------------------------------------------------
// Serials
// ---------------------------------------------------------------------------

/**
 * `S-000123` for Standard, `P-000045` for Premium.
 *
 * Read aloud over a phone, typed into the assign box when a camera will not
 * focus, and printed under the QR. Short enough to say, long enough not to run
 * out, and prefixed because a Premium blank and a Standard card are identical
 * from the back — the prefix is the only thing that tells staff which they are
 * holding.
 *
 * It carries NO information about the token. Anyone who reads a serial off a
 * card in a display case must learn nothing about where that card points.
 */
const SERIAL_PATTERN = /^[SP]-\d{6}$/;

export function isValidSerial(value: string | null | undefined): boolean {
  return SERIAL_PATTERN.test(normalizeSerial(value));
}

/** Upper-cases and trims, so a serial typed in lower case still matches. */
export function normalizeSerial(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function serialPrefix(variant: CardVariant): string {
  return variant === "premium" ? "P" : "S";
}

export function formatSerial(variant: CardVariant, n: number): string {
  return `${serialPrefix(variant)}-${String(Math.max(0, Math.floor(n))).padStart(6, "0")}`;
}

/** The variant a serial claims to be, or null if it is not a serial. */
export function variantFromSerial(value: string | null | undefined): CardVariant | null {
  const s = normalizeSerial(value);
  if (!SERIAL_PATTERN.test(s)) return null;
  return s.startsWith("P") ? "premium" : "standard";
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

export type ScanResult =
  /** A 32-hex token, however it was wrapped. */
  | { kind: "token"; token: string }
  /** A printed serial. */
  | { kind: "serial"; serial: string }
  | { kind: "unknown" };

/**
 * What did that scan mean?
 *
 * Three things can arrive here and all three are legitimate:
 *
 *   * a full URL, from the camera reading the QR on the back of a card
 *   * a bare token, from an NDEF record or a paste
 *   * a serial, typed by hand when the camera will not cooperate
 *
 * The URL form has to tolerate more than it looks. The printed QR carries
 * `?src=qr` so the tap is attributed correctly, chips are encoded with the plain
 * URL, some readers append a trailing slash, and a card printed before the
 * domain moved would carry an older host. So the host is deliberately NOT
 * checked: what identifies a card is the token, the token is validated on its
 * own, and refusing a card because it was printed against a previous hostname
 * would strand real plastic for no gain in safety.
 */
export function parseScan(raw: string | null | undefined): ScanResult {
  const input = (raw ?? "").trim();
  if (!input) return { kind: "unknown" };

  // A bare token, or a token someone pasted with surrounding whitespace.
  if (isValidToken(input.toLowerCase())) {
    return { kind: "token", token: input.toLowerCase() };
  }

  const serial = normalizeSerial(input);
  if (SERIAL_PATTERN.test(serial)) return { kind: "serial", serial };

  const token = tokenFromUrl(input);
  if (token) return { kind: "token", token };

  return { kind: "unknown" };
}

/**
 * Pull the token out of a `/t/<token>` URL.
 *
 * Hand-parsed rather than via `new URL`, because a scan can arrive without a
 * scheme (`taptap.hornbilltech.co.ke/t/abc…`), which `new URL` rejects outright,
 * and prefixing a scheme to guess at it is more code than finding the segment.
 */
export function tokenFromUrl(raw: string | null | undefined): string | null {
  const input = (raw ?? "").trim();
  if (!input) return null;

  // Everything before a query string or a fragment.
  const path = input.split(/[?#]/)[0];
  const segments = path.split("/").filter(Boolean);

  const marker = segments.lastIndexOf("t");
  if (marker < 0 || marker === segments.length - 1) return null;

  const candidate = segments[marker + 1].toLowerCase();
  return isValidToken(candidate) ? candidate : null;
}

// ---------------------------------------------------------------------------
// What the supplier prints from
// ---------------------------------------------------------------------------

export type BatchCsvRow = {
  serial: string | null;
  variant: string | null;
  token: string;
};

/**
 * One row per card: what to print on it, and what its QR must encode.
 *
 * The QR carries `?src=qr` and the chip is encoded with the plain URL. That one
 * difference is the whole of how a scan is told apart from a tap afterwards —
 * without it, every QR scan of every card would be counted as an NFC tap and the
 * analytics would quietly claim hardware engagement we never had, which §15
 * forbids.
 */
export function batchCsv(
  batchCode: string,
  rows: BatchCsvRow[],
  siteUrl: string,
): string {
  return toCsv(
    ["batch", "serial", "variant", "qr_url"],
    rows.map((r) => [batchCode, r.serial ?? "", r.variant ?? "", qrUrlFor(siteUrl, r.token)]),
  );
}

/** The URL the printed QR encodes. */
export function qrUrlFor(siteUrl: string, token: string): string {
  return `${tokenUrl(siteUrl, token)}?src=qr`;
}

/** The URL the chip is encoded with. Plain, because a tap is already a tap. */
export function chipUrlFor(siteUrl: string, token: string): string {
  return tokenUrl(siteUrl, token);
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

export type StockCount = { variant: string; state: string; count: number };

/** How many of a variant are on the shelf right now. */
export function inStockFor(counts: StockCount[] | null | undefined, variant: string): number {
  return (counts ?? [])
    .filter((c) => c.variant === variant && c.state === "in_stock")
    .reduce((sum, c) => sum + (Number.isFinite(c.count) ? c.count : 0), 0);
}

/**
 * Variants that need reordering.
 *
 * Counted against what is sellable — `received` cards have blank chips and
 * cannot fill an order, so including them would report a shelf that is full of
 * cards nobody can send.
 */
export function lowStockVariants(
  counts: StockCount[] | null | undefined,
  threshold: number = LOW_STOCK_THRESHOLD,
): { variant: string; inStock: number }[] {
  const variants = Array.from(new Set((counts ?? []).map((c) => c.variant).filter(Boolean)));
  return variants
    .map((variant) => ({ variant, inStock: inStockFor(counts, variant) }))
    .filter((v) => v.inStock < threshold)
    .sort((a, b) => a.inStock - b.inStock);
}
