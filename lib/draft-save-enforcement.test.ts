import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Migration 0030, asserted against its text — the publish-enforcement.test.ts
 * approach, for the same reason: these rules live in SQL, so a TypeScript suite
 * could pass in full while the database did something else.
 *
 * The behaviour itself was run against a real Postgres (PGlite) with RLS on
 * before this shipped — saves, conflicts, rollbacks, other accounts, clicks on
 * removed actions; see docs/mobile/PROGRESS.md (M2). These assertions stop a
 * later edit from quietly undoing the parts that matter most.
 */
const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/0030_page_draft_and_click_attribution.sql"),
  "utf8",
);

/** Strips SQL line comments so prose about a rule cannot pass for the rule. */
const CODE = SQL.split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

function body(fn: string): string {
  const start = CODE.indexOf(`create or replace function public.${fn}(`);
  expect(start, fn).toBeGreaterThan(-1);
  const open = CODE.indexOf("$$", start);
  const close = CODE.indexOf("$$", open + 2);
  return CODE.slice(start, close);
}

describe("save_page_draft", () => {
  const fn = body("save_page_draft");

  it("runs as the caller, so RLS and the column grants still apply", () => {
    expect(fn).toMatch(/security\s+invoker/i);
    expect(fn).not.toMatch(/security\s+definer/i);
  });

  it("checks the version in the same statement as the write", () => {
    expect(fn).toMatch(
      /update\s+public\.smart_pages[\s\S]*?where\s+id\s*=\s*p_page_id\s+and\s+updated_at\s*=\s*p_expected_updated_at/i,
    );
  });

  it("requires a signed-in user and a version", () => {
    expect(fn).toMatch(/if\s+auth\.uid\(\)\s+is\s+null\s+then\s+raise/i);
    expect(fn).toMatch(/if\s+p_expected_updated_at\s+is\s+null\s+then\s+raise/i);
  });

  it("updates actions by id instead of re-creating them, and only within the page", () => {
    expect(fn).toMatch(/on\s+conflict\s*\(id\)\s+do\s+update/i);
    expect(fn).toMatch(/where\s+public\.links\.smart_page_id\s*=\s*p_page_id/i);
    expect(fn).toMatch(/delete\s+from\s+public\.links\s+where\s+smart_page_id\s*=\s*p_page_id\s+and\s+not\s*\(id\s*=\s*any\(v_ids\)\)/i);
  });

  it("refuses an action id that did not end up on this page", () => {
    expect(fn).toMatch(/<>\s*cardinality\(v_ids\)\s+then\s+raise\s+exception\s+'invalid_block_id'/i);
  });

  it("is callable by signed-in users only", () => {
    expect(CODE).toMatch(/revoke\s+execute\s+on\s+function\s+public\.save_page_draft\([^)]*\)\s+from\s+public,\s*anon/i);
    expect(CODE).toMatch(/grant\s+execute\s+on\s+function\s+public\.save_page_draft\([^)]*\)\s+to\s+authenticated;/i);
    expect(CODE).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.save_page_draft\([^)]*\)\s+to\s+[^;]*anon/i);
  });
});

describe("updated_at is the draft's version", () => {
  const fn = body("smart_pages_touch_draft");

  it("moves only when a draft column changes", () => {
    expect(fn).toMatch(
      /\(new\.title,\s*new\.mode,\s*new\.redirect_url,\s*new\.config,\s*new\.theme\)\s+is\s+distinct\s+from\s+\(old\.title,\s*old\.mode,\s*old\.redirect_url,\s*old\.config,\s*old\.theme\)/i,
    );
    expect(fn).not.toMatch(/status|published|is_active/i);
  });

  it("replaces the old always-bump trigger on smart_pages", () => {
    expect(CODE).toMatch(/drop\s+trigger\s+if\s+exists\s+smart_pages_set_updated_at\s+on\s+public\.smart_pages/i);
    expect(CODE).toMatch(
      /create\s+trigger\s+smart_pages_touch_draft\s+before\s+update\s+on\s+public\.smart_pages\s+for\s+each\s+row\s+execute\s+function\s+public\.smart_pages_touch_draft\(\)/i,
    );
    // set_updated_at() may serve other tables; it must survive.
    expect(CODE).not.toMatch(/drop\s+function[^;]*set_updated_at/i);
  });
});

describe("log_event never loses a click", () => {
  const fn = body("log_event");

  it("keeps the 10-argument signature every caller uses", () => {
    expect(fn).toMatch(/p_source\s+text\s+default\s+null,\s*p_tag_id\s+uuid\s+default\s+null/i);
    expect(CODE).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.log_event\(\s*uuid,\s*text,\s*uuid,\s*text,\s*text,\s*text,\s*text,\s*text,\s*text,\s*uuid\s*\)\s+to\s+anon,\s*authenticated/i,
    );
  });

  it("records an action only if it belongs to this page", () => {
    expect(fn).toMatch(
      /select\s+id\s+into\s+v_link_id\s+from\s+public\.links\s+where\s+id\s*=\s*p_link_id\s+and\s+smart_page_id\s*=\s*p_page_id/i,
    );
    expect(fn).toMatch(/values\s*\(\s*p_page_id,\s*p_type,\s*v_link_id,/i);
  });

  it("still refuses unknown event types and sources", () => {
    expect(fn).toMatch(/p_type\s+not\s+in\s+\('tap',\s*'scan',\s*'view',\s*'click',\s*'download',\s*'lead'\)/i);
    expect(fn).toMatch(/p_source\s+not\s+in\s+\('nfc',\s*'qr',\s*'direct',\s*'web'\)/i);
  });
});
