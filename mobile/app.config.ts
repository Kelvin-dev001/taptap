import { existsSync } from "node:fs";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * One app, three variants (docs/mobile/PLAN.md §5.1). APP_VARIANT is set per
 * build profile in eas.json; running `expo start` locally means development.
 *
 *   development  the dev client. Its own bundle ID, so it installs beside the
 *                real app instead of replacing it.
 *   preview      internal testing builds (TestFlight internal, Play internal).
 *   production   the store app.
 *
 * app.json stays nearly empty on purpose: `eas init` writes the project id and
 * owner there, EAS Update its URL, and they arrive here as `config`. EAS
 * commands also copy whatever this file resolves to (dev bundle IDs included)
 * into app.json — trim it back to those three after any of them.
 */
type Variant = "development" | "preview" | "production";

const VARIANT: Variant = (() => {
  const raw = process.env.APP_VARIANT;
  return raw === "preview" || raw === "production" ? raw : "development";
})();
const IS_DEV = VARIANT === "development";

/** Permanent once published — confirmed by Kelvin, 28 Sep 2026. */
const BUNDLE_ID = "ke.co.hornbilltech.taptap";

/**
 * The per-weight Inter files, embedded at build time so text never renders in
 * the system font first (no loading step). Android names a family after its
 * file and iOS after the PostScript name; src/theme/typography.ts maps both.
 */
/**
 * Firebase's Android config, which a phone needs before it can get a push
 * token (PLAN.md §4.7). On EAS it arrives as a file environment variable
 * (GOOGLE_SERVICES_JSON); locally, as a git-ignored google-services.json.
 * Without either, the app still builds and runs — push registration simply
 * does nothing on Android.
 */
const GOOGLE_SERVICES =
  process.env.GOOGLE_SERVICES_JSON ?? (existsSync("./google-services.json") ? "./google-services.json" : undefined);

/**
 * Website links the app opens instead of the browser (PLAN.md §9 W10, D-049):
 * exact paths only, the dashboard links that lead and first-tap emails send.
 * Card taps (/t/…), profile links (/<slug>), billing and orders always stay in
 * the browser. Kept equal to lib/app-links.ts by src/links/links.test.ts — a
 * config file cannot import it, because EAS evaluates this file on its own.
 */
const APP_LINK_HOST = "taptap.hornbilltech.co.ke";
const APP_LINK_PATHS = ["/dashboard", "/dashboard/customers", "/dashboard/analytics"];

const INTER = ["400Regular", "500Medium", "600SemiBold", "700Bold"].map(
  (weight) => `node_modules/@expo-google-fonts/inter/${weight}/Inter_${weight}.ttf`,
);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? "TapTap Dev" : "TapTap",
  slug: "hornbill-taptap",
  version: "0.1.0",
  orientation: "portrait",
  // Not `taptap://`: that scheme belongs to a large game-store app (PLAN.md §0 #9).
  scheme: IS_DEV ? "hornbilltaptap-dev" : "hornbilltaptap",
  userInterfaceStyle: "automatic",
  backgroundColor: "#FBFBFA",
  ios: {
    bundleIdentifier: IS_DEV ? `${BUNDLE_ID}.dev` : BUNDLE_ID,
    // iPhone only in v1: an iPad build would need its own screenshots and layouts.
    supportsTablet: false,
    infoPlist: {
      // HTTPS only — the standard exemption, so no export-compliance paperwork.
      ITSAppUsesNonExemptEncryption: false,
    },
    // Which paths open the app is the website's apple-app-site-association.
    associatedDomains: [`applinks:${APP_LINK_HOST}`],
  },
  android: {
    package: IS_DEV ? `${BUNDLE_ID}.dev` : BUNDLE_ID,
    ...(GOOGLE_SERVICES ? { googleServicesFile: GOOGLE_SERVICES } : {}),
    // Cached leads are customers' personal data; they must not ride along in
    // Google Drive backups (PLAN.md §4.5).
    allowBackup: false,
    // autoVerify: Android checks the website's assetlinks.json at install and,
    // once verified, opens these links without asking. Exact `path`s, never a
    // prefix.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: APP_LINK_PATHS.map((path) => ({ scheme: "https", host: APP_LINK_HOST, path })),
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    // Only what the app uses (brief: permissions only when needed). An empty
    // list drops Expo's default extras; the blocked ones are what its template
    // would otherwise still merge in. NFC and INTERNET come from their modules.
    permissions: [],
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
      // expo-network asks for Wi-Fi state for getIpAddressAsync, which the app
      // never calls. Online/offline needs only ACCESS_NETWORK_STATE, kept.
      "android.permission.ACCESS_WIFI_STATE",
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        // Android's splash theme always points at a logo drawable, and the
        // plugin only generates one from `image`: without it the build fails
        // at processDebugResources. A fully transparent placeholder until the
        // hornbill mark is prepared for light and dark splashes in M8.
        image: "./assets/splash-placeholder.png",
        imageWidth: 200,
        backgroundColor: "#FBFBFA",
        dark: { backgroundColor: "#141414" },
      },
    ],
    ["expo-font", { ios: { fonts: INTER }, android: { fonts: INTER } }],
    "expo-localization",
    // Holds the key that encrypts the saved session (src/auth/encrypted-storage.ts).
    // Its Android backup rules keep that key out of backups, matching allowBackup: false.
    "expo-secure-store",
    // Works around an @expo/ui crash on reload (PROGRESS.md, M1 finding 21).
    "./plugins/with-expo-core-preload",
    [
      "expo-image-picker",
      {
        // The profile photo comes from the photo library only. `false` blocks
        // the camera and microphone permissions the library would otherwise
        // bring in; Android's system photo picker needs no permission at all.
        photosPermission: "TapTap opens your photos so you can choose a profile photo or logo.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    // Push (M5). POST_NOTIFICATIONS is asked for only after the in-app
    // explainer, never at launch. The orange tints the small icon; a proper
    // monochrome notification icon comes with the brand assets in M8.
    ["expo-notifications", { color: "#C2560A" }],
    [
      "react-native-nfc-manager",
      {
        nfcPermission: "TapTap reads your TapTap card so you can set it up.",
        // An NDEF entry in the entitlement makes App Store Connect reject the
        // upload (ITMS-90778). TAG alone still reads NDEF records.
        includeNdefEntitlement: false,
      },
    ],
    [
      "@sentry/react-native/expo",
      {
        // Source-map upload during EAS builds. Read from the build environment;
        // the auth token itself only ever lives in EAS secrets.
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        url: "https://sentry.io/",
      },
    ],
  ],
  runtimeVersion: { policy: "fingerprint" },
  extra: {
    ...config.extra,
    variant: VARIANT,
  },
});
