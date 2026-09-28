import Constants from "expo-constants";

export type Variant = "development" | "preview" | "production";

/** Which build this is — set by app.config.ts from the EAS build profile. */
export const variant: Variant = (() => {
  const raw = Constants.expoConfig?.extra?.variant;
  return raw === "preview" || raw === "production" ? raw : "development";
})();

export const appVersion: string = Constants.expoConfig?.version ?? "0.0.0";

/** Test hooks and check screens exist in development and preview builds only. */
export const devToolsEnabled = variant !== "production";
