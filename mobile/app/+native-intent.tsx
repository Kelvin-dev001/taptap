import { appRouteForUrl } from "@taptap/core/app-links";

/**
 * Expo Router hands every URL the system opens the app with to this first.
 *
 * A website link (PLAN.md §9 W10, D-049) becomes the screen it stands for —
 * new-lead emails open Leads, first-tap emails Analytics — and never a path
 * read from the link itself. Anything else (the app's own scheme, the
 * development client's URLs) goes on unchanged. Signed out, the usual guard
 * still sends the person to sign in first.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return appRouteForUrl(path) ?? path;
}
