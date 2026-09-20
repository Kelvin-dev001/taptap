import type { PageConfig, Theme } from "./profile";
import { DEFAULT_THEME } from "./profile";

/**
 * The Premium card front (D-029).
 *
 * A Premium card is a stock blank with its front left printable. What goes on
 * that front is generated from the customer's own Tap Profile on one fixed
 * template, they approve a proof, and we print it.
 *
 * Everything here is pure, and deliberately so: the same functions drive the
 * live preview in the dashboard, the print page, and the 300dpi PNG staff
 * actually print from. One renderer means what the customer approved is what
 * comes out of the printer, which is the only property of this feature that
 * really matters.
 */

// ---------------------------------------------------------------------------
// The card itself
// ---------------------------------------------------------------------------

/** CR80, the bank-card size every ID printer expects. */
export const CR80_WIDTH_MM = 85.6;
export const CR80_HEIGHT_MM = 54;

/**
 * Nothing important goes within 3mm of the edge. Card printers drift, and a
 * name clipped by a millimetre is a reprint.
 */
export const CR80_SAFE_MM = 3;

/** 300dpi, the resolution a dye-sub ID printer wants. 85.6mm = 1011px. */
export const PRINT_WIDTH_PX = 1011;
export const PRINT_HEIGHT_PX = 638;

// ---------------------------------------------------------------------------
// What goes on the front
// ---------------------------------------------------------------------------

export type ProofFields = {
  /** The big line. The business or person the card belongs to. */
  name: string;
  /** Under it. A job title, or whatever the profile's tagline says. */
  title: string | null;
  /** Under that. The organisation, when it differs from the name. */
  org: string | null;
  logoUrl: string | null;
  accent: string;
};

/**
 * Pull the front's content out of a Tap Profile.
 *
 * Reads the same fields the public page does, so a card cannot say something
 * the profile does not. `org` is dropped when it merely repeats the name: a
 * card reading "Magangi & Company" twice looks like a mistake, because it is.
 */
export function proofFieldsFromPage(page: {
  title?: string | null;
  config?: PageConfig | null;
  theme?: Theme | null;
}): ProofFields {
  const config = page.config ?? {};
  const contact = config.contact ?? {};

  const name = (page.title ?? "").trim();
  const title = (contact.title ?? config.tagline ?? "").trim() || null;
  const org = (contact.org ?? "").trim() || null;

  return {
    name,
    title,
    org: org && org.toLowerCase() !== name.toLowerCase() ? org : null,
    logoUrl: (config.avatarUrl ?? "").trim() || null,
    accent: (page.theme?.accent ?? DEFAULT_THEME.accent).trim() || DEFAULT_THEME.accent,
  };
}

// ---------------------------------------------------------------------------
// Making it fit
// ---------------------------------------------------------------------------

/**
 * How much text each line can hold at a given size, before it has to shrink.
 *
 * Character counts rather than measured text, because this has to produce the
 * same answer in three places — a browser preview, a print page and Satori
 * rendering the PNG — and only one of those can measure a font. An
 * approximation that is identical everywhere beats an exact measurement that
 * differs between the proof and the print.
 *
 * The counts are deliberately conservative. Being slightly small is invisible;
 * being slightly large collides with the safe margin and gets reprinted.
 */
const NAME_STEPS = [
  { size: 46, maxChars: 16 },
  { size: 38, maxChars: 21 },
  { size: 32, maxChars: 26 },
  { size: 27, maxChars: 32 },
  { size: 23, maxChars: 40 },
] as const;

const TITLE_STEPS = [
  { size: 22, maxChars: 30 },
  { size: 19, maxChars: 38 },
  { size: 16, maxChars: 48 },
] as const;

const ORG_STEPS = [
  { size: 18, maxChars: 34 },
  { size: 16, maxChars: 42 },
  { size: 14, maxChars: 52 },
] as const;

/** A line, sized to fit, and truncated only when nothing else will do. */
export type FittedLine = {
  text: string;
  /** Font size in px, at the 1011 × 638 print scale. */
  size: number;
  /** True when the text had to be cut. Staff see this and can shorten it. */
  truncated: boolean;
};

export type FittedProof = {
  name: FittedLine;
  title: FittedLine | null;
  org: FittedLine | null;
  /** Any line that had to be cut, so the UI can warn rather than surprise. */
  anyTruncated: boolean;
};

function fitLine(
  raw: string,
  steps: readonly { size: number; maxChars: number }[],
): FittedLine {
  const text = raw.replace(/\s+/g, " ").trim();

  for (const step of steps) {
    if (text.length <= step.maxChars) {
      return { text, size: step.size, truncated: false };
    }
  }

  // Nothing fits: take the smallest size and cut. An ellipsis rather than a
  // hard stop, so it reads as deliberate rather than as a rendering fault.
  const last = steps[steps.length - 1];
  return {
    text: `${text.slice(0, Math.max(last.maxChars - 1, 1)).trimEnd()}…`,
    size: last.size,
    truncated: true,
  };
}

/**
 * Size every line so the whole front fits inside the safe area.
 *
 * Each line shrinks independently. A long name next to a short title should not
 * drag the title down with it — that wastes the space the name did not need.
 */
export function fitProof(fields: ProofFields): FittedProof {
  const name = fitLine(fields.name || "Untitled", NAME_STEPS);
  const title = fields.title ? fitLine(fields.title, TITLE_STEPS) : null;
  const org = fields.org ? fitLine(fields.org, ORG_STEPS) : null;

  return {
    name,
    title,
    org,
    anyTruncated: Boolean(name.truncated || title?.truncated || org?.truncated),
  };
}

// ---------------------------------------------------------------------------
// Freezing it
// ---------------------------------------------------------------------------

/**
 * What was approved, captured so later edits cannot change what gets printed.
 *
 * The customer approves a specific card. If they then rename their profile or
 * swap the logo, the card already in production must not silently change — and
 * they must not discover the difference when it arrives. So approval freezes
 * the text and the logo URL, and the print output reads the snapshot rather
 * than the live profile.
 *
 * `approvedAt` is recorded by the database, not here: a timestamp from a
 * customer's browser is a timestamp from an unsynchronised clock.
 */
export type ProofSnapshot = ProofFields & {
  /** Which profile it came from, for staff tracing it back. */
  pageId: string;
  /** Bumped if the template ever changes, so old snapshots stay readable. */
  version: 1;
};

export function proofSnapshot(pageId: string, fields: ProofFields): ProofSnapshot {
  return { ...fields, pageId, version: 1 };
}

/** Has the profile changed since the customer approved it? */
export function snapshotDiffers(
  snapshot: ProofSnapshot | null | undefined,
  current: ProofFields,
): boolean {
  if (!snapshot) return false;
  return (
    snapshot.name !== current.name ||
    snapshot.title !== current.title ||
    snapshot.org !== current.org ||
    snapshot.logoUrl !== current.logoUrl ||
    snapshot.accent !== current.accent
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export const PROOF_STATUSES = [
  "pending",
  "awaiting_approval",
  "approved",
  "revision_requested",
] as const;

export type ProofStatus = (typeof PROOF_STATUSES)[number];

export function isProofStatus(value: string | null | undefined): value is ProofStatus {
  return PROOF_STATUSES.includes((value ?? "") as ProofStatus);
}

export const PROOF_STATUS_META: Record<
  ProofStatus,
  { label: string; customerLabel: string; description: string; tone: "neutral" | "warning" | "success" | "info" }
> = {
  pending: {
    label: "Awaiting profile",
    customerLabel: "Choose a profile",
    description: "Pick which Tap Profile goes on the front of this card",
    tone: "warning",
  },
  awaiting_approval: {
    label: "With the customer",
    customerLabel: "Ready for your approval",
    description: "Check the front and approve it, or ask for changes",
    tone: "info",
  },
  approved: {
    label: "Approved",
    customerLabel: "Approved",
    description: "Approved for printing. The design is frozen as approved",
    tone: "success",
  },
  revision_requested: {
    label: "Changes requested",
    customerLabel: "Changes requested",
    description: "We are working on the changes you asked for",
    tone: "warning",
  },
};

/**
 * Why this proof cannot be approved yet, or null if it can.
 *
 * The published rule is the one that matters: a card must work when it arrives.
 * Printing somebody's name onto plastic that opens a draft nobody can see is a
 * card that is dead on delivery (D-021).
 */
export function approvalBlockedReason(unit: {
  proof_status?: string | null;
  proof_page_id?: string | null;
  pagePublished?: boolean;
}): string | null {
  if (!unit.proof_page_id) return "Choose which profile goes on this card first.";
  if (unit.proof_status === "approved") return "This card is already approved.";
  if (unit.pagePublished === false) {
    return "Publish this profile before approving. A card that opens an unpublished page arrives dead.";
  }
  return null;
}
