import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Migration 0031, asserted against its text (the publish-enforcement.test.ts
 * approach). Its behaviour was run against a real Postgres (PGlite) before it
 * shipped — paging across tied timestamps, the web's existing call returning
 * the same leads, the 5,000 cap, the grants; see docs/mobile/PROGRESS.md (M3).
 */
const SQL = readFileSync(join(process.cwd(), "supabase/migrations/0031_leads_cursor.sql"), "utf8");
const CODE = SQL.split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("get_leads with a cursor", () => {
  it("replaces the old signature in the same migration, so PostgREST sees one function", () => {
    expect(CODE).toMatch(/drop\s+function\s+if\s+exists\s+public\.get_leads\(int,\s*uuid,\s*text,\s*int\)/i);
    expect(CODE.match(/create\s+function\s+public\.get_leads\(/gi)).toHaveLength(1);
  });

  it("keeps the web's four arguments first, with their defaults, and adds the cursor after them", () => {
    expect(CODE).toMatch(
      /p_days\s+int\s+default\s+90,\s*p_page_id\s+uuid\s+default\s+null,\s*p_status\s+text\s+default\s+null,\s*p_limit\s+int\s+default\s+200,\s*p_before_created_at\s+timestamptz\s+default\s+null,\s*p_before_id\s+uuid\s+default\s+null/i,
    );
  });

  it("orders by created_at then id, so tied timestamps page without repeats or gaps", () => {
    expect(CODE).toMatch(/order\s+by\s+created_at\s+desc,\s*id\s+desc/i);
    expect(CODE).toMatch(/order\s+by\s+s\.created_at\s+desc,\s*s\.id\s+desc/i);
    expect(CODE).toMatch(/l\.created_at\s*=\s*p_before_created_at\s+and\s+p_before_id\s+is\s+not\s+null\s+and\s+l\.id\s*<\s*p_before_id/i);
  });

  it("caps a page at 5,000 — what the CSV export asks for — not lower", () => {
    expect(CODE).toMatch(/least\(greatest\(coalesce\(p_limit,\s*200\),\s*1\),\s*5000\)/i);
  });

  it("stays scoped to the caller's account and closed to anon", () => {
    expect(CODE).toMatch(/where\s+id\s*=\s*auth\.uid\(\)/i);
    expect(CODE).toMatch(/revoke\s+execute\s+on\s+function\s+public\.get_leads\([^)]*\)\s+from\s+public,\s*anon/i);
    expect(CODE).toMatch(/grant\s+execute\s+on\s+function\s+public\.get_leads\([^)]*\)\s+to\s+authenticated;/i);
  });
});
