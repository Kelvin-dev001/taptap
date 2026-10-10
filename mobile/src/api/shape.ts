/**
 * Checks that a server answer has the shape this app version expects
 * (PLAN.md §4.5), with types inferred from the check itself.
 *
 * Hand-written instead of zod: in Metro, which does not tree-shake, even
 * `zod/mini` bundles every one of zod's languages — 889 KB of source, more than
 * supabase-js, measured on 9 Oct 2026 (PROGRESS.md finding 15). The app only
 * needs strings, numbers, booleans, nulls, arrays and objects.
 *
 * Objects keep only the keys they name, so a column the server adds later is
 * ignored rather than trusted.
 */

export class ShapeIssue extends Error {
  constructor(readonly path: string) {
    super(`Unexpected value at ${path || "(root)"}`);
    this.name = "ShapeIssue";
  }
}

export type Check<T> = (value: unknown, path: string) => T;
export type Infer<C> = C extends Check<infer T> ? T : never;

const join = (path: string, key: string | number) =>
  typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key;

export const string: Check<string> = (value, path) => {
  if (typeof value === "string") return value;
  throw new ShapeIssue(path);
};

export const number: Check<number> = (value, path) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new ShapeIssue(path);
};

export const boolean: Check<boolean> = (value, path) => {
  if (typeof value === "boolean") return value;
  throw new ShapeIssue(path);
};

export function nullable<T>(check: Check<T>): Check<T | null> {
  return (value, path) => (value === null || value === undefined ? null : check(value, path));
}

export function array<T>(item: Check<T>): Check<T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) throw new ShapeIssue(path);
    return value.map((entry, i) => item(entry, join(path, i)));
  };
}

export function object<S extends Record<string, Check<unknown>>>(
  shape: S,
): Check<{ [K in keyof S]: Infer<S[K]> }> {
  return (value, path) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new ShapeIssue(path);
    }
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) out[key] = shape[key](source[key], join(path, key));
    return out as { [K in keyof S]: Infer<S[K]> };
  };
}
