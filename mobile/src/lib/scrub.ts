/**
 * Removes personal data from text before it leaves the phone in a crash report
 * (PLAN.md §4.11). Leads carry customers' names and numbers, and a thrown error
 * or a breadcrumb can quote them — Sentry must never receive them.
 *
 * Deliberately over-eager: a scrubbed number in a stack trace costs nothing, a
 * leaked phone number is a data-protection incident.
 */

const PATTERNS: [RegExp, string][] = [
  // Supabase access and refresh tokens (JWTs).
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[jwt]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  // Card tokens: 32 hex characters, the permanent identity of a physical card.
  [/\b[a-f0-9]{32}\b/gi, "[token]"],
  // Phone numbers: Kenyan (07…, 01…, +254…, 254…) and other international forms.
  [/(?:\+|\b)254[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g, "[phone]"],
  [/\b0[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g, "[phone]"],
  [/\+\d[\d\s-]{7,14}\d/g, "[phone]"],
];

export function scrubText(text: string): string {
  return PATTERNS.reduce((acc, [pattern, label]) => acc.replace(pattern, label), text);
}

/** Scrubs every string inside a JSON-like value, however deeply nested. */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === "string") return scrubText(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = scrubDeep(v, depth + 1);
    return out as T;
  }
  return value;
}
