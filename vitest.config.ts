import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json.
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    // Pure logic tests stay on the fast node environment; component tests opt
    // into jsdom by filename, so the lib suite pays nothing for the DOM.
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // mobile/ is the Expo app with its own Jest suite (docs/mobile/PLAN.md §5).
    // Without this, Vitest would run its React Native tests under jsdom and
    // crawl mobile/node_modules for test files.
    exclude: ["node_modules", ".next", "mobile/**"],
  },
});
