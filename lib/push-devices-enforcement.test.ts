import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Migration 0034, asserted against its text. Its behaviour was run against a
 * real Postgres (PGlite) with RLS and roles before it shipped; see
 * docs/mobile/PROGRESS.md (M5).
 */
const SQL = readFileSync(join(process.cwd(), "supabase/migrations/0034_push_devices.sql"), "utf8");
const CODE = SQL.split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("push_devices", () => {
  it("lets a person read only their own phones, and write none directly", () => {
    expect(CODE).toMatch(/alter\s+table\s+public\.push_devices\s+enable\s+row\s+level\s+security/i);
    expect(CODE).toMatch(/for\s+select\s+using\s+\(user_id\s*=\s*\(select\s+auth\.uid\(\)\)\)/i);
    expect(CODE).toMatch(/revoke\s+insert,\s*update,\s*delete\s+on\s+public\.push_devices\s+from\s+anon,\s*authenticated/i);
    expect(CODE).not.toMatch(/create\s+policy[^;]*for\s+(insert|update|delete|all)/i);
  });

  it("takes the user from the session and the account from profiles", () => {
    expect(CODE).toMatch(/v_user\s+uuid\s*:=\s*auth\.uid\(\)/i);
    expect(CODE).toMatch(/select\s+account_id\s+into\s+v_account\s+from\s+public\.profiles\s+where\s+id\s*=\s*v_user/i);
  });

  it("removes and changes only the caller's own phone", () => {
    expect(CODE).toMatch(/delete\s+from\s+public\.push_devices\s+where\s+token\s*=\s*p_token\s+and\s+user_id\s*=\s*auth\.uid\(\)/i);
    expect(CODE).toMatch(/where\s+token\s*=\s*p_token\s+and\s+user_id\s*=\s*auth\.uid\(\)\s+returning\s+prefs/i);
  });

  it("keeps the server's reads for the service role", () => {
    for (const fn of ["push_targets\\(uuid,\\s*text\\)", "forget_push_tokens\\(text\\[\\]\\)"]) {
      expect(CODE).toMatch(new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\s+from\\s+public,\\s*anon,\\s*authenticated`, "i"));
      expect(CODE).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\s+to\\s+service_role`, "i"));
    }
  });

  it("follows the person: deleting them deletes their phones", () => {
    expect(CODE).toMatch(/user_id\s+uuid\s+not\s+null\s+references\s+auth\.users\(id\)\s+on\s+delete\s+cascade/i);
  });

  it("accepts only Expo push tokens and the three known switches", () => {
    expect(CODE).toMatch(/token\s+~\s+'\^Expo\(nent\)\?PushToken/i);
    expect(CODE).toMatch(/e\.key\s+not\s+in\s+\('lead',\s*'first_tap',\s*'term'\)/i);
  });
});
