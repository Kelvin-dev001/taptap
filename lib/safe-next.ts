/**
 * Only ever redirect within this site.
 *
 * `next` is attacker-controllable — it arrives from a URL inside an email, and
 * from a query string on the login page — so an unchecked value is an open
 * redirect that fires on a session which has just been authenticated. That is
 * the worst moment for one: the victim is signed in and primed to trust
 * wherever they land.
 *
 * Requiring a single leading slash rejects absolute URLs (`https://evil.example`)
 * and protocol-relative ones (`//evil.example`), which browsers treat as
 * absolute.
 *
 * Lives in lib/ rather than beside the auth callback because the login form
 * needs the same guard, and a client component cannot import from a route
 * handler. One implementation, one set of tests, no second version to drift.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}
