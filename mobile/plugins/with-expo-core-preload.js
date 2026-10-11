const { withMainApplication } = require("expo/config-plugins");

/**
 * Loads expo-modules-core's native library as the app starts (PROGRESS.md, M1 finding 21).
 *
 * The library registers its JNI methods when it loads, and on its own it only loads once the
 * app's JavaScript starts running. Since SDK 57's 6 Oct patches, @expo/ui calls one of those
 * methods (`NativeStatePropsGetter.clearAllContentOrigins`) whenever a React instance is torn
 * down, without checking. So any teardown before the JavaScript ran — a reload after a bundle
 * that failed to download, or expo-updates reloading after a startup error — crashed with
 * `UnsatisfiedLinkError` and hid the real error. Loading the library first makes the call safe.
 *
 * Remove once Expo fixes @expo/ui; check with a reload from the red error screen on a phone.
 */
const MARKER = 'SoLoader.loadLibrary("expo-modules-core")';

function addPreload(contents) {
  if (contents.includes(MARKER)) return contents;
  const anchor = /(\n([ \t]*)loadReactNative\(this\)[ \t]*\n)/;
  const match = contents.match(anchor);
  if (!match) {
    throw new Error(
      "with-expo-core-preload: loadReactNative(this) not found in MainApplication; the template changed",
    );
  }
  const indent = match[2];
  return contents.replace(
    anchor,
    `$1${indent}// Before any React instance exists: see plugins/with-expo-core-preload.js\n` +
      `${indent}com.facebook.soloader.${MARKER}\n`,
  );
}

function withExpoCorePreload(config) {
  return withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error("with-expo-core-preload: expected a Kotlin MainApplication");
    }
    cfg.modResults.contents = addPreload(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withExpoCorePreload;
module.exports.addPreload = addPreload;
