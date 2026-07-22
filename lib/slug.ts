import { RESERVED_SLUGS } from "./reserved-slugs";

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

export type SlugCheck =
  | { valid: true; slug: string }
  | { valid: false; reason: string };

/**
 * Normalize user input toward a candidate slug: lowercase, trim, collapse
 * whitespace/underscores to single hyphens, strip invalid characters, and
 * collapse repeated hyphens. Does NOT guarantee validity — always follow with
 * validateSlug().
 */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-") // spaces / underscores -> hyphen
    .replace(/[^a-z0-9-]/g, "") // drop anything not allowed
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/**
 * Validate a slug against the platform rules. Input is normalized first, so
 * callers may pass raw user input. Returns the normalized slug when valid.
 */
export function validateSlug(input: string): SlugCheck {
  const slug = normalizeSlug(input);

  if (slug.length < SLUG_MIN_LENGTH) {
    return {
      valid: false,
      reason: `Must be at least ${SLUG_MIN_LENGTH} characters.`,
    };
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    return {
      valid: false,
      reason: `Must be at most ${SLUG_MAX_LENGTH} characters.`,
    };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      valid: false,
      reason: "Use lowercase letters, numbers, and single hyphens only.",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, reason: "That name is reserved." };
  }

  return { valid: true, slug };
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(normalizeSlug(slug));
}
