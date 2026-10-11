/**
 * Phone numbers as Kenyans write them — 0722…, 0110…, 722…, +254 722…, 254-722…
 * — checked before they reach a WhatsApp or Call button (docs/mobile/PLAN.md
 * §9 W6). A wrong-length number makes `wa.me` show "phone number is invalid"
 * to the business's customer, and nobody tells the business (lib/blocks.ts,
 * toInternational).
 *
 * Pure, and shared with the app (lib/mobile-shared.json).
 */

import { DEFAULT_COUNTRY_CODE, toInternational } from "./blocks";

export type PhoneCheck =
  | { ok: true; international: string }
  | { ok: false; reason: "empty" | "invalid" | "tooShort" | "tooLong" };

/**
 * Digits after the country code, where every number has the same length. Every
 * Kenyan number, mobile (7…, 1…) or landline (20…), has nine. A market added
 * later goes here; anything not listed is only checked against E.164.
 */
const NATIONAL_DIGITS: Record<string, number> = { "254": 9 };
/** E.164: at most 15 digits including the country code; real numbers rarely run under 8. */
const E164_MIN = 8;
const E164_MAX = 15;

/**
 * Whether a number can be dialled and opened in WhatsApp, and its international
 * digits (no +) when it can. Spaces, dashes, dots and brackets are fine; letters
 * are not. Numbers outside Kenya must start with + and are only length-checked.
 */
export function checkPhone(value: string, countryCode = DEFAULT_COUNTRY_CODE): PhoneCheck {
  const raw = value.trim();
  if (!raw) return { ok: false, reason: "empty" };
  if (!/^\+?[\d\s().-]+$/.test(raw)) return { ok: false, reason: "invalid" };

  const international = toInternational(raw, countryCode);
  const expected = NATIONAL_DIGITS[countryCode];
  if (expected !== undefined && international.startsWith(countryCode)) {
    const national = international.length - countryCode.length;
    if (national < expected) return { ok: false, reason: "tooShort" };
    if (national > expected) return { ok: false, reason: "tooLong" };
    return { ok: true, international };
  }
  if (international.length < E164_MIN) return { ok: false, reason: "tooShort" };
  if (international.length > E164_MAX) return { ok: false, reason: "tooLong" };
  return { ok: true, international };
}
