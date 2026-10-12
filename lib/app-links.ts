/**
 * Which website links open the app (docs/mobile/PLAN.md §9 W10, M6; D-049).
 *
 * The website publishes two files — `/.well-known/assetlinks.json` (Android)
 * and `/.well-known/apple-app-site-association` (iPhone) — and the app declares
 * the same paths in its own config. A link opens the app only when both agree,
 * and only if the app is installed; everything else stays in the browser.
 *
 * The list is EXACT paths, never a prefix. Two promises depend on that:
 *
 *  - Card taps (`/t/<token>`) and profile links (`/<slug>`) must ALWAYS open the
 *    browser: they are what a business's customers tap, and a customer who also
 *    owns a TapTap account must still see the business's page, not their own
 *    dashboard.
 *  - Billing and order links stay in the browser: the app takes no payments
 *    (D-036), and orders live on the web only.
 *
 * Each entry is a link our emails actually send (lib/notifications/*-email.ts).
 * Pure: shared with the app (lib/mobile-shared.json), which maps an incoming
 * link to its screen with `appRouteForUrl`.
 */

export const APP_LINK_HOST = "taptap.hornbilltech.co.ke";

export interface AppLink {
  /** The website path, matched exactly (a trailing slash is tolerated). */
  web: string;
  /** The app screen it opens (an Expo Router path). */
  app: string;
  /** Which email sends it. */
  from: string;
}

export const APP_LINKS: readonly AppLink[] = [
  { web: "/dashboard", app: "/", from: "first-tap email, card not yet on a profile" },
  { web: "/dashboard/customers", app: "/leads", from: "new-lead email" },
  { web: "/dashboard/analytics", app: "/analytics", from: "first-tap email" },
];

/**
 * Android apps allowed to open these links, with the SHA-256 fingerprint of the
 * certificate each is signed with. Fingerprints are public by design.
 *
 *  - `.dev`: the EAS development keystore, read from build e2dff455 (12 Oct 2026).
 *  - The store app (`ke.co.hornbilltech.taptap`) is added once Google Play App
 *    Signing gives its key (Play Console → App integrity), in M7/M8. Until then
 *    the store app opens no links, which is safe: the browser still works.
 */
export const ANDROID_APPS: readonly { package: string; sha256: readonly string[] }[] = [
  {
    package: "ke.co.hornbilltech.taptap.dev",
    sha256: ["C1:03:EF:71:03:31:FB:FF:0E:50:1A:8D:8F:81:79:3C:20:F8:F1:EE:E0:EC:3E:54:B2:82:F2:84:35:5D:CB:6C"],
  },
];

/**
 * Apple's Team ID, from developer.apple.com → Membership, once the organisation
 * enrolment (waiting on the D-U-N-S number) is done. While it is null the
 * iPhone file is not served at all, so iOS opens every link in Safari.
 */
export const APPLE_TEAM_ID: string | null = null;

export const IOS_BUNDLE_IDS = ["ke.co.hornbilltech.taptap", "ke.co.hornbilltech.taptap.dev"] as const;

function normalise(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** The app screen for a website path, or null when the path is not one of ours. */
export function appRouteForWebPath(path: string): string | null {
  const wanted = normalise(path);
  return APP_LINKS.find((link) => link.web === wanted)?.app ?? null;
}

/**
 * Where the app goes when the system hands it a URL.
 *
 *  - An https link on our host → its screen, or Home for any path not on the
 *    list (an old cached association file could still send one).
 *  - Anything else (the app's own scheme, the development client's URLs, a bare
 *    path) → null: not a website link, so the caller leaves it alone.
 */
export function appRouteForUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== APP_LINK_HOST) return null;
  return appRouteForWebPath(parsed.pathname) ?? "/";
}

/** `/.well-known/assetlinks.json` (Digital Asset Links). */
export function assetLinks() {
  return ANDROID_APPS.map((app) => ({
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: app.package,
      sha256_cert_fingerprints: [...app.sha256],
    },
  }));
}

/**
 * `/.well-known/apple-app-site-association`, or null while there is no Team
 * ID. `components` lists exact paths only; anything unmatched stays in Safari.
 */
export function appleAppSiteAssociation(teamId: string | null = APPLE_TEAM_ID) {
  if (!teamId) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: IOS_BUNDLE_IDS.map((bundle) => `${teamId}.${bundle}`),
          components: APP_LINKS.map((link) => ({ "/": link.web, comment: link.from })),
        },
      ],
    },
  };
}
