// Only allow destinations with schemes we intend to support. This prevents
// unsafe schemes (javascript:, data:, etc.) from being used as redirect targets.
const ALLOWED_SCHEMES = new Set(["http:", "https:", "tel:", "mailto:"]);

export function isSafeDestination(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return ALLOWED_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}
