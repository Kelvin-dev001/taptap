const path = require("node:path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

/**
 * Sentry's wrapper around Expo's Metro config: it adds the debug ids that let
 * crash reports map back to source.
 *
 * The app imports pure modules from the web's lib/ folder (docs/mobile/PLAN.md
 * §5.2), so Metro has to watch it. Those files import no packages at all —
 * lib/mobile-shared.test.ts in the web suite enforces that — so nothing from the
 * web's node_modules can leak into the app through them.
 */
const config = getSentryExpoConfig(__dirname);

config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../lib")];

module.exports = config;
