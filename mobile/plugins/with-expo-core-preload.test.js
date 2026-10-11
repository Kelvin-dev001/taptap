const { describe, expect, it } = require("@jest/globals");
const { addPreload } = require("./with-expo-core-preload");

// The relevant part of SDK 57's generated MainApplication.kt.
const TEMPLATE = `  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = ReleaseLevel.STABLE
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
`;

describe("with-expo-core-preload", () => {
  it("loads expo-modules-core right after React Native, before any React instance", () => {
    const out = addPreload(TEMPLATE);
    const lines = out.split("\n").map((l) => l.trim());
    const rn = lines.indexOf("loadReactNative(this)");
    expect(lines[rn + 2]).toBe('com.facebook.soloader.SoLoader.loadLibrary("expo-modules-core")');
    expect(lines.indexOf("ApplicationLifecycleDispatcher.onApplicationCreate(this)")).toBe(rn + 3);
  });

  it("keeps the template's indentation", () => {
    expect(addPreload(TEMPLATE)).toContain(
      '\n    com.facebook.soloader.SoLoader.loadLibrary("expo-modules-core")\n',
    );
  });

  it("is safe to run twice", () => {
    const once = addPreload(TEMPLATE);
    expect(addPreload(once)).toBe(once);
  });

  it("fails the build loudly if the template no longer has the anchor", () => {
    expect(() => addPreload("class MainApplication {}")).toThrow(/loadReactNative/);
  });
});
