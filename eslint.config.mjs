import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint 9 flat config.
 *
 * `next lint` was removed in Next 16, so linting runs through the ESLint CLI
 * directly (`npm run lint`). eslint-config-next 16 publishes native flat-config
 * arrays, so these are spread straight in — no FlatCompat shim needed.
 */
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "tsconfig.tsbuildinfo"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Supabase RPC responses and server-action payloads are genuinely untyped
      // at the boundary; keep this visible without failing the build.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
