import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, type Dirent } from "node:fs";
import path from "node:path";

/**
 * Guards the React Server Component boundary.
 *
 * Two bugs shipped past the build, the type checker and the whole test suite
 * because nothing checks this boundary statically:
 *
 *   1. A server page passed `formatLabel={fn}` to a Client Component, which
 *      throws "Functions cannot be passed directly to Client Components".
 *   2. A server page CALLED `parseProfileFilter()`, exported from a
 *      `"use client"` module, which throws "Attempted to call … from the
 *      server but … is on the client".
 *
 * Both only appear at request time, on a signed-in page — the exact blind spot
 * in every automated check we run. These tests close it.
 */

const SRC_DIRS = ["app", "components", "lib"];
const IGNORE = [".next", "node_modules"];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (IGNORE.some((i) => full.includes(i))) continue;
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  for (const d of SRC_DIRS) walk(d);
  return out;
}

const files = sourceFiles().map((f) => ({
  path: f.replace(/\\/g, "/"),
  source: readFileSync(f, "utf8"),
}));

const isClient = (source: string) => source.trimStart().startsWith('"use client"');
const clientFiles = files.filter((f) => isClient(f.source));
const serverFiles = files.filter((f) => !isClient(f.source));

describe("RSC boundary", () => {
  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(30);
    expect(clientFiles.length).toBeGreaterThan(5);
  });

  /**
   * Regression: `parseProfileFilter` was exported from a "use client" module
   * and called by the profiles page, which broke that screen entirely for
   * every signed-in user.
   */
  it("never imports a client module's helper into a server file", () => {
    // Non-component exports from client modules: lowerCamel or SCREAMING_CASE.
    const clientExports = new Map<string, Set<string>>();
    for (const f of clientFiles) {
      const names = new Set<string>();
      const patterns = [
        /export\s+(?:async\s+)?(?:function|const)\s+([a-z][A-Za-z0-9_]*)/g,
        /export\s+const\s+([A-Z_]{3,})\s*[=:]/g,
      ];
      for (const re of patterns) {
        for (const m of f.source.matchAll(re)) names.add(m[1]);
      }
      // Hooks are legitimately client-only and are never called from a server
      // file; they would fail loudly and immediately in development.
      for (const name of [...names]) if (/^use[A-Z]/.test(name)) names.delete(name);
      if (names.size) clientExports.set(f.path, names);
    }

    const violations: string[] = [];
    for (const server of serverFiles) {
      for (const [clientPath, names] of clientExports) {
        const moduleName = path.basename(clientPath).replace(/\.tsx?$/, "");
        const importRe = new RegExp(
          `import\\s*\\{([^}]+)\\}\\s*from\\s*"[^"]*${moduleName}"`,
          "g",
        );
        for (const m of server.source.matchAll(importRe)) {
          const imported = m[1]
            .split(",")
            .map((s) => s.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, ""))
            .filter(Boolean);
          for (const name of imported) {
            // A type-only import is erased at compile time and is always safe.
            if (names.has(name) && !m[1].includes(`type ${name}`)) {
              violations.push(`${server.path} imports ${name} from ${clientPath}`);
            }
          }
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  /**
   * Regression: `<BarChart formatLabel={shortDate}>` from a server page threw
   * "Functions cannot be passed directly to Client Components" the first time
   * a signed-in user opened the dashboard.
   */
  it("never passes a bare function-valued prop from a server file into a component", () => {
    const violations: string[] = [];
    // Props that take callbacks/formatters, assigned a bare identifier.
    const propRe =
      /<([A-Z][A-Za-z0-9]*)\b[^>]*?\s(on[A-Z][A-Za-z0-9]*|format[A-Za-z0-9]*|render[A-Za-z0-9]*|compare[A-Za-z0-9]*)=\{([a-zA-Z_$][\w$]*)\}/gs;

    for (const server of serverFiles) {
      for (const m of server.source.matchAll(propRe)) {
        // Server Actions are the one function type that may legitimately cross
        // the boundary; they are marked "use server" and named *Action.
        if (/Action$/.test(m[3])) continue;
        violations.push(`${server.path}: <${m[1]} ${m[2]}={${m[3]}}>`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
