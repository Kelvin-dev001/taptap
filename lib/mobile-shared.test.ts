import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import shared from "./mobile-shared.json";

/**
 * The mobile app imports these lib/ files directly — no copy, no package — so a
 * rule changed here reaches both products (docs/mobile/PLAN.md §5.2). That only
 * works while the files stay pure. One `import { cookies } from "next/headers"`
 * added for a web feature would break the app's build, and a `process.env` read
 * would quietly return undefined on a phone.
 *
 * So the contract is checked here, in the web suite, where such a change would
 * be made. The app's own lint refuses to import anything not on the list.
 */

const modules: string[] = shared.modules;
const allowed = new Set(modules);

function source(name: string): string {
  return readFileSync(path.join(__dirname, `${name}.ts`), "utf8");
}

/**
 * Drops comments so prose about "the warning window" or "process.env is
 * inlined" cannot fail the check. The line-comment rule skips `://`, so URLs
 * inside strings survive.
 */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/** Every module specifier the file imports or re-exports, static or dynamic. */
function specifiers(code: string): string[] {
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /^\s*import\s+["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  return patterns.flatMap((pattern) => [...code.matchAll(pattern)].map((m) => m[1]));
}

describe("the guard itself", () => {
  it("finds every kind of import", () => {
    const code = [
      'import { cookies } from "next/headers";',
      "import type { X } from './profile';",
      'export { y } from "./blocks";',
      'import "server-only";',
      'const m = await import("node:fs");',
    ].join("\n");
    expect(specifiers(code)).toEqual(["next/headers", "./profile", "./blocks", "server-only", "node:fs"]);
  });

  it("ignores comments but keeps URLs inside strings", () => {
    const code = 'const a = "https://wa.me/"; // read process.env here\n/* from "next" */';
    expect(withoutComments(code)).toBe('const a = "https://wa.me/"; \n');
    expect(specifiers(withoutComments(code))).toEqual([]);
  });
});

describe("lib modules shared with the mobile app", () => {
  it("lists only files that exist, once each", () => {
    expect(new Set(modules).size).toBe(modules.length);
    for (const name of modules) {
      expect(existsSync(path.join(__dirname, `${name}.ts`)), `lib/${name}.ts`).toBe(true);
    }
  });

  it.each(modules)("%s imports only other shared modules", (name) => {
    for (const spec of specifiers(withoutComments(source(name)))) {
      // A package, an alias or a Node built-in would have to exist in the app too.
      expect(spec.startsWith("./"), `lib/${name}.ts imports "${spec}"`).toBe(true);
      const target = spec.slice(2).replace(/\.ts$/, "");
      expect(allowed.has(target), `lib/${name}.ts imports unshared "./${target}"`).toBe(true);
    }
  });

  it.each(modules)("%s touches no environment, DOM or server API", (name) => {
    const code = withoutComments(source(name));
    // Environment variables differ per platform and are inlined differently.
    expect(code, `lib/${name}.ts reads process.env`).not.toMatch(/\bprocess\.env\b/);
    // There is no DOM on a phone.
    expect(code, `lib/${name}.ts uses a browser global`).not.toMatch(
      /\b(window|document|localStorage|sessionStorage|navigator)\.[A-Za-z_$]/,
    );
  });
});
