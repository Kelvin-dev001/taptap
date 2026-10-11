/**
 * A profile draft as both editors send it — the web's Save and the mobile app's
 * autosave (docs/mobile/PLAN.md §9 W4) — and the rules it must pass before it
 * is written.
 *
 * Pure, and shared with the app (lib/mobile-shared.json), so the app checks an
 * action exactly as the server will: what the app accepts, the server accepts.
 * The write itself lives in lib/page-draft.ts.
 */

import { BLOCK_DEFS, buildHref } from "./blocks";
import type { BlockType, PageConfig, Theme } from "./profile";
import { isSafeDestination } from "./url";

/** One action. The id is made by whichever editor created it (D-046). */
export type DraftBlock = {
  id: string;
  type: BlockType;
  label: string;
  value: string;
  isActive: boolean;
};

export type DraftInput = {
  /** The `updated_at` this draft was based on, exactly as the server sent it. */
  expectedUpdatedAt: string;
  title: string;
  /** Absent from the app, which never switches a profile's type; the page's own is kept. */
  mode?: "page" | "redirect";
  redirectUrl?: string;
  config: PageConfig;
  theme: Theme;
  /** In display order. Ignored for a redirect profile. */
  blocks: DraftBlock[];
};

/** Generous ceilings: they stop abuse, not owners. The database caps actions at 100 too. */
export const DRAFT_LIMITS = {
  title: 200,
  label: 120,
  value: 2048,
  blocks: 100,
  /** The serialised size of config and theme together. */
  json: 32_000,
} as const;

const BLOCK_TYPES = new Set<string>(BLOCK_DEFS.map((d) => d.type));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && BLOCK_TYPES.has(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type ParsedDraft = { ok: true; input: DraftInput } | { ok: false; field: string };

/**
 * Checks the shape of an untrusted draft — a JSON body, or a server action's
 * argument, which is just as reachable by anyone. Names the first field that
 * is wrong, never the value.
 */
export function parseDraftInput(body: unknown): ParsedDraft {
  const fail = (field: string): ParsedDraft => ({ ok: false, field });
  if (!isPlainObject(body)) return fail("body");

  const { expectedUpdatedAt, title, mode, redirectUrl, config, theme, blocks } = body;
  if (typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt || expectedUpdatedAt.length > 64) {
    return fail("expectedUpdatedAt");
  }
  if (typeof title !== "string" || title.length > DRAFT_LIMITS.title) return fail("title");
  if (mode !== undefined && mode !== "page" && mode !== "redirect") return fail("mode");
  if (redirectUrl !== undefined && (typeof redirectUrl !== "string" || redirectUrl.length > DRAFT_LIMITS.value)) {
    return fail("redirectUrl");
  }
  if (!isPlainObject(config)) return fail("config");
  if (!isPlainObject(theme)) return fail("theme");
  if (JSON.stringify(config).length + JSON.stringify(theme).length > DRAFT_LIMITS.json) {
    return fail("config");
  }
  if (!Array.isArray(blocks) || blocks.length > DRAFT_LIMITS.blocks) return fail("blocks");

  const seen = new Set<string>();
  const parsed: DraftBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b: unknown = blocks[i];
    if (!isPlainObject(b)) return fail(`blocks[${i}]`);
    if (!isUuid(b.id) || seen.has(b.id.toLowerCase())) return fail(`blocks[${i}].id`);
    seen.add(b.id.toLowerCase());
    if (!isBlockType(b.type)) return fail(`blocks[${i}].type`);
    if (typeof b.label !== "string" || b.label.length > DRAFT_LIMITS.label) return fail(`blocks[${i}].label`);
    if (typeof b.value !== "string" || b.value.length > DRAFT_LIMITS.value) return fail(`blocks[${i}].value`);
    if (typeof b.isActive !== "boolean") return fail(`blocks[${i}].isActive`);
    parsed.push({ id: b.id, type: b.type, label: b.label, value: b.value, isActive: b.isActive });
  }

  return {
    ok: true,
    input: {
      expectedUpdatedAt,
      title,
      ...(mode !== undefined ? { mode } : {}),
      ...(redirectUrl !== undefined ? { redirectUrl } : {}),
      config: config as PageConfig,
      theme: theme as Theme,
      blocks: parsed,
    },
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Why an action's value would make a dead button, or null if it works.
 *
 * Empty is allowed here — an action can be added before it is filled in, as the
 * web editor always has — and the public page simply has nothing to open. A
 * value that is present must produce a destination a phone can open.
 */
export function actionValueProblem(type: BlockType, value: string): "invalid" | null {
  const v = value.trim();
  if (!v) return null;
  if (type === "contact" || type === "mpesa") return null;
  if (type === "email") return EMAIL.test(v) ? null : "invalid";
  if (type === "directions" && !/^https?:\/\//i.test(v)) return null; // an address, searched in Maps
  if (type === "call" || type === "whatsapp") return /\d/.test(v) ? null : "invalid";
  const href = buildHref(type, v);
  return href && isSafeDestination(href) ? null : "invalid";
}

export type DraftProblem =
  | { code: "invalid_destination"; index: number }
  | { code: "invalid_redirect" };

/** The first rule a draft breaks, or null. `mode` is the profile's type after the save. */
export function draftProblem(input: DraftInput, mode: "page" | "redirect"): DraftProblem | null {
  if (mode === "redirect") {
    return isSafeDestination(input.redirectUrl) ? null : { code: "invalid_redirect" };
  }
  const index = input.blocks.findIndex((b) => actionValueProblem(b.type, b.value) !== null);
  return index >= 0 ? { code: "invalid_destination", index } : null;
}

/**
 * Lead capture follows the account's live cards (D-018), and that is decided on
 * the server: a client cannot grant itself the form by sending `enabled: true`.
 */
export function withLeadFormRule(config: PageConfig, leadCaptureAllowed: boolean): PageConfig {
  if (leadCaptureAllowed || !config.leadForm?.enabled) return config;
  return { ...config, leadForm: { ...config.leadForm, enabled: false } };
}
