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
 * owner there, and they arrive here as `config`.
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
  },
  android: {
    package: IS_DEV ? `${BUNDLE_ID}.dev` : BUNDLE_ID,
    // Cached leads are customers' personal data; they must not ride along in
    // Google Drive backups (PLAN.md §4.5).
    allowBackup: false,
    // Only what the app uses (brief: permissions only when needed). An empty
    // list drops Expo's default extras; the blocked ones are what its template
    // would otherwise still merge in. NFC and INTERNET come from their modules.
    permissions: [],
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FBFBFA",
        dark: { backgroundColor: "#141414" },
      },
    ],
    ["expo-font", { ios: { fonts: INTER }, android: { fonts: INTER } }],
    "expo-localization",
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
