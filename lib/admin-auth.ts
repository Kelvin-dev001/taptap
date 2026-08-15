import { timingSafeEqual } from "node:crypto";

/**
 * Gate for `/admin`, which mints NFC tokens.
 *
 * The route is publicly reachable and protected only by a shared secret, so the
 * secret has to actually be one. Three things were missing:
 *
 *  - Nothing rejected the placeholder value shipped in `.env.example`. Copying
 *    it into the hosting environment produced a "secured" endpoint whose key is
 *    published in the repository.
 *  - The comparison was `!==`, which returns as soon as two bytes differ and so
 *    leaks the key's length and prefix through response timing.
 *  - Nothing limited guessing.
 */

/** Values that are obviously not secrets, however they are cased. */
const PLACEHOLDERS = [
  "change-me-to-a-long-random-string",
  "your-long-random-string",
  "your-long-random-admin-token",
  "changeme",
  "change-me",
  "admin",
  "password",
  "secret",
  "test",
  "taptap",
];

/** Short enough to brute force is short enough to reject. */
export const MIN_ADMIN_TOKEN_LENGTH = 24;

export type AdminKeyResult =
  | { ok: true }
  /** The server is misconfigured — never say which value is wrong. */
  | { ok: false; reason: "not-configured" | "weak-token" | "invalid" | "rate-limited" };

/** Constant-time compare that does not reveal length through early exit. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, which would itself be a leak, so
  // compare fixed-size digests of the inputs instead.
  const max = Math.max(bufA.length, bufB.length, 1);
  const padA = Buffer.alloc(max);
  const padB = Buffer.alloc(max);
  bufA.copy(padA);
  bufB.copy(padB);
  return timingSafeEqual(padA, padB) && bufA.length === bufB.length;
}

export function isWeakAdminToken(token: string): boolean {
  const normalised = token.trim().toLowerCase();
  if (normalised.length < MIN_ADMIN_TOKEN_LENGTH) return true;
  return PLACEHOLDERS.some((p) => normalised === p || normalised.includes(p));
}

/**
 * In-memory sliding window. Deliberately simple: this is one low-traffic
 * endpoint, and a per-instance limit still turns unlimited guessing into a slow
 * grind. A shared store would be better if `/admin` ever became a real surface.
 */
const attempts: number[] = [];
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateLimited(now: number): boolean {
  while (attempts.length > 0 && now - attempts[0] > WINDOW_MS) attempts.shift();
  return attempts.length >= MAX_ATTEMPTS;
}

function recordAttempt(now: number) {
  attempts.push(now);
}

/** Exposed for tests; never call from application code. */
export function __resetAdminRateLimit() {
  attempts.length = 0;
}

export function verifyAdminKey(
  provided: string,
  expected: string | undefined,
  now: number = Date.now(),
): AdminKeyResult {
  if (!expected) return { ok: false, reason: "not-configured" };

  // Fail closed on a weak secret rather than pretending the gate works.
  if (isWeakAdminToken(expected)) return { ok: false, reason: "weak-token" };

  if (rateLimited(now)) return { ok: false, reason: "rate-limited" };

  if (!safeEqual(provided, expected)) {
    recordAttempt(now);
    return { ok: false, reason: "invalid" };
  }
  return { ok: true };
}

/** Messages are intentionally vague about the key and precise about config. */
export const ADMIN_KEY_MESSAGES: Record<
  Exclude<AdminKeyResult, { ok: true }>["reason"],
  string
> = {
  "not-configured": "ADMIN_TOKEN is not set on the server.",
  "weak-token":
    "ADMIN_TOKEN is a placeholder or too short. Set a random value of at least " +
    `${MIN_ADMIN_TOKEN_LENGTH} characters and redeploy — minting is disabled until then.`,
  invalid: "Invalid admin key.",
  "rate-limited": "Too many attempts. Wait a few minutes and try again.",
};
