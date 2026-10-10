const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const i18next = require("eslint-plugin-i18next");
const shared = require("../lib/mobile-shared.json");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "android/*", "ios/*", "coverage/*", "expo-env.d.ts"],
  },
  {
    // Every word a person sees or hears goes through i18n (PLAN.md §4.9), so
    // Kiswahili is a translation job rather than a rewrite. JSX text plus the
    // props that carry words — including the ones only screen readers speak.
    files: ["app/**/*.tsx", "src/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            include: [
              "accessibilityLabel",
              "accessibilityHint",
              "placeholder",
              "title",
              "label",
              "message",
              "description",
            ],
          },
        },
      ],
    },
  },
  {
    rules: {
      // Only the lib/ modules vetted as pure may be imported from the web
      // (lib/mobile-shared.json). Anything else could drag server code or
      // Next.js into the app.
      "no-restricted-imports": [
        "error",
        {
          // Metro does not tree-shake, so the package root bundles every icon
          // (+3.5 MB of bytecode). src/ui/icons.ts imports them one by one.
          paths: [
            {
              name: "lucide-react-native",
              message: "Import icons from @/ui/icons (add new ones there, one file each).",
            },
          ],
          patterns: [
            {
              group: ["@taptap/core/*", ...shared.modules.map((m) => `!@taptap/core/${m}`)],
              message: "Only modules listed in lib/mobile-shared.json may be imported.",
            },
            {
              group: ["../lib/*", "../../lib/*", "../../../lib/*"],
              message: "Import shared web modules through @taptap/core/<name>.",
            },
          ],
        },
      ],
    },
  },
  {
    // The one place allowed to name lucide-react-native, for its type only.
    files: ["src/ui/icons.ts"],
    rules: { "no-restricted-imports": "off" },
  },
]);
