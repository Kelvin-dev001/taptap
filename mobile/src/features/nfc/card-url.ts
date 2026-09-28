import { isValidToken } from "@taptap/core/tags";

/**
 * What a TapTap chip carries, and how to read it (PLAN.md §4.6).
 *
 * Encoding writes exactly one NDEF URI record — `https://taptap.hornbilltech.co.ke/t/<token>`
 * (lib/stock.ts `chipUrlFor`, D-031) — and the printed QR adds `?src=qr`.
 * Anything else is not a TapTap card. The chip's hardware UID is never used:
 * UID, token and slug are different things (CLAUDE.md §18).
 *
 * Pure on purpose: the parsing is tested without a phone or a card.
 */

/** NFC Forum URI Record Type Definition: the first payload byte abbreviates a prefix. */
const URI_PREFIXES = [
  "",
  "http://www.",
  "https://www.",
  "http://",
  "https://",
  "tel:",
  "mailto:",
  "ftp://anonymous:anonymous@",
  "ftp://ftp.",
  "ftps://",
  "sftp://",
  "smb://",
  "nfs://",
  "ftp://",
  "dav://",
  "news:",
  "telnet://",
  "imap:",
  "rtsp://",
  "urn:",
  "pop:",
  "sip:",
  "sips:",
  "tftp:",
  "btspp://",
  "btl2cap://",
  "btgoep://",
  "tcpobex://",
  "irdaobex://",
  "file://",
  "urn:epc:id:",
  "urn:epc:tag:",
  "urn:epc:pat:",
  "urn:epc:raw:",
  "urn:epc:",
  "urn:nfc:",
];

/** The shape react-native-nfc-manager returns for each record. */
export type NdefRecordLike = {
  tnf: number;
  type: number[] | string;
  payload: number[];
};

const TNF_WELL_KNOWN = 0x01;
const RTD_URI = 0x55; // "U"

function isUriRecord(record: NdefRecordLike): boolean {
  if (record.tnf !== TNF_WELL_KNOWN) return false;
  return typeof record.type === "string"
    ? record.type === "U"
    : record.type.length === 1 && record.type[0] === RTD_URI;
}

/** A small UTF-8 decoder: Hermes has no guaranteed TextDecoder. */
export function decodeUtf8(bytes: readonly number[]): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const lead = bytes[i++];
    if (lead < 0x80) {
      out += String.fromCharCode(lead);
      continue;
    }
    let extra: number;
    let codePoint: number;
    if ((lead & 0xe0) === 0xc0) [extra, codePoint] = [1, lead & 0x1f];
    else if ((lead & 0xf0) === 0xe0) [extra, codePoint] = [2, lead & 0x0f];
    else if ((lead & 0xf8) === 0xf0) [extra, codePoint] = [3, lead & 0x07];
    else {
      out += "�";
      continue;
    }
    let valid = i + extra <= bytes.length;
    for (let k = 0; valid && k < extra; k++) {
      const next = bytes[i++];
      if ((next & 0xc0) !== 0x80) valid = false;
      else codePoint = (codePoint << 6) | (next & 0x3f);
    }
    out += valid ? String.fromCodePoint(codePoint) : "�";
  }
  return out;
}

/** The full URI in a URI record, or null for any other kind of record. */
export function uriFromRecord(record: NdefRecordLike): string | null {
  if (!isUriRecord(record) || record.payload.length === 0) return null;
  // Codes past the table are reserved; the spec says treat them as no prefix.
  const prefix = URI_PREFIXES[record.payload[0]] ?? "";
  return prefix + decodeUtf8(record.payload.slice(1));
}

/**
 * The card token in a TapTap card URL, or null. HTTPS only, our host only,
 * `/t/<32 lowercase hex>` only — a locked chip carries exactly that.
 */
export function tokenFromCardUrl(url: string): string | null {
  const match = /^https:\/\/taptap\.hornbilltech\.co\.ke\/t\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(
    url.trim(),
  );
  if (!match) return null;
  return isValidToken(match[1]) ? match[1] : null;
}

export type CardRead =
  /** A TapTap card: its token and the URL it was read from. */
  | { kind: "card"; token: string; url: string }
  /** A tag with a link, but not a TapTap card's. */
  | { kind: "other"; url: string }
  /** A tag with no link on it at all. */
  | { kind: "empty" };

export function readCardRecords(records: readonly NdefRecordLike[] | null | undefined): CardRead {
  const uris = (records ?? []).map(uriFromRecord).filter((uri): uri is string => uri !== null);
  for (const url of uris) {
    const token = tokenFromCardUrl(url);
    if (token) return { kind: "card", token, url };
  }
  return uris.length > 0 ? { kind: "other", url: uris[0] } : { kind: "empty" };
}
