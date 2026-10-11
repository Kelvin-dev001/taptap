import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Migration 0033, asserted against its text. Its behaviour was run against a
 * real Postgres (PGlite) with the production foreign keys before it shipped:
 * what goes, what stays, other accounts untouched, staff refused, retries
 * harmless; see docs/mobile/PROGRESS.md (M4). These stop a later edit from
 * undoing the parts that protect the tax record and other businesses.
 */
const SQL = readFileSync(join(process.cwd(), "supabase/migrations/0033_account_deletion.sql"), "utf8");
const CODE = SQL.split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("delete_account", () => {
  it("can only be called by the service role", () => {
    expect(CODE).toMatch(/revoke\s+execute\s+on\s+function\s+public\.delete_account\(uuid\)\s+from\s+public,\s*anon,\s*authenticated/i);
    expect(CODE).toMatch(/grant\s+execute\s+on\s+function\s+public\.delete_account\(uuid\)\s+to\s+service_role;/i);
    expect(CODE).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.delete_account\(uuid\)\s+to\s+[^;]*authenticated/i);
  });

  it("never deletes the account row, payments or orders — the tax record", () => {
    expect(CODE).not.toMatch(/delete\s+from\s+public\.(accounts|payments|orders|order_units|order_events)\b/i);
    expect(CODE).toMatch(/update\s+public\.accounts\s+set\s+name\s*=\s*'Deleted account'/i);
  });

  it("removes only the member when others share the account", () => {
    expect(CODE).toMatch(/if\s+v_members\s*>\s*1\s+then[\s\S]*?return\s+jsonb_build_object\('scope',\s*'member'\)/i);
  });

  it("strips personal details from what it keeps", () => {
    expect(CODE).toMatch(/contact_name\s*=\s*null/i);
    expect(CODE).toMatch(/contact_phone\s*=\s*null/i);
    expect(CODE).toMatch(/delivery_notes\s*=\s*null/i);
    expect(CODE).toMatch(/update\s+public\.order_events\s+set\s+note\s*=\s*null/i);
    expect(CODE).toMatch(/proof_snapshot\s*=\s*null/i);
    expect(CODE).toMatch(/update\s+public\.payments\s+set\s+raw\s*=/i);
  });

  it("switches cards off and keeps them on the account, never back into stock", () => {
    expect(CODE).toMatch(/update\s+public\.nfc_tags\s+set\s+status\s*=\s*'disabled',\s*smart_page_id\s*=\s*null,\s*label\s*=\s*null/i);
    expect(CODE).not.toMatch(/account_id\s*=\s*null/i);
  });

  it("refuses Hornbill staff", () => {
    expect(CODE).toMatch(/from\s+public\.staff\s+where\s+user_id\s*=\s*p_user_id\)\s+then\s+raise\s+exception\s+'staff_account'/i);
  });

  it("keeps its audit table closed to the app", () => {
    expect(CODE).toMatch(/alter\s+table\s+public\.account_deletions\s+enable\s+row\s+level\s+security/i);
    expect(CODE).toMatch(/revoke\s+all\s+on\s+public\.account_deletions\s+from\s+anon,\s*authenticated/i);
    expect(CODE).not.toMatch(/create\s+policy[^;]*account_deletions/i);
  });
});
