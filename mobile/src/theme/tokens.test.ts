import { readFileSync } from "node:fs";
import path from "node:path";
import { duration, lightColors, orange, type ColorTokens } from "./tokens";

/**
 * The app's light tokens are the web's (PLAN.md §4.8). This reads the web's
 * app/globals.css and fails if a value drifted, in either direction.
 */

const css = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf8");

function cssVariables(source: string): Map<string, string> {
  const root = /:root\s*{([\s\S]*?)}/.exec(source)?.[1] ?? "";
  const vars = new Map<string, string>();
  for (const [, name, value] of root.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    vars.set(name, value.replace(/\/\*[\s\S]*?\*\//g, "").trim());
  }
  return vars;
}

const vars = cssVariables(css);

/** Follows var(--x) references to the literal value. */
function resolve(name: string, seen: string[] = []): string {
  const value = vars.get(name);
  if (value === undefined) throw new Error(`--${name} is not defined in app/globals.css`);
  const ref = /^var\(--([a-z0-9-]+)\)$/.exec(value);
  if (!ref) return value.toLowerCase();
  if (seen.includes(ref[1])) throw new Error(`circular --${name}`);
  return resolve(ref[1], [...seen, name]);
}

/** Tokens the web has no variable for, because only the app needs them. */
const APP_ONLY: (keyof ColorTokens)[] = [
  "accentText",
  "dangerText",
  "accentFill",
  "onAccentFill",
  "accentFillPressed",
];

const kebab = (key: string) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

describe("light tokens match the web", () => {
  const shared = (Object.keys(lightColors) as (keyof ColorTokens)[]).filter(
    (key) => !APP_ONLY.includes(key),
  );

  it.each(shared)("%s", (key) => {
    expect(lightColors[key]).toBe(resolve(`color-${kebab(key)}`));
  });

  it("the brand ramp", () => {
    for (const [step, value] of Object.entries(orange)) {
      expect(`${step}: ${value}`).toBe(`${step}: ${resolve(`color-primary-${step}`)}`);
    }
  });

  it("the motion durations", () => {
    expect(`${duration.fast}ms`).toBe(resolve("duration-fast"));
    expect(`${duration.base}ms`).toBe(resolve("duration-base"));
    expect(`${duration.slow}ms`).toBe(resolve("duration-slow"));
  });
});
