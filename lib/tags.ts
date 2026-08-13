// NFC tag tokens. Uses the global Web Crypto (available in Node 19+ and edge) —
// no import needed, so this stays safe to reference from any runtime.

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function isValidToken(t: string | null | undefined): boolean {
  return /^[a-f0-9]{32}$/.test(t ?? "");
}

/** The public tap URL for a token, given the site base. */
export function tokenUrl(base: string, token: string): string {
  return `${base.replace(/\/$/, "")}/t/${token}`;
}
