import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What a customer may write to `nfc_tags`, asserted against the migration.
 *
 * The same technique and the same reason as lib/publish-enforcement.test.ts: the
 * rule lives in SQL, so a suite that only exercises lib/identity.ts would pass in
 * full while every customer could grant themselves a term that never ends.
 *
 * The one these exist for above all: `authenticated` held a table-wide UPDATE
 * grant on `nfc_tags` from 0005 until this migration, which meant
 * `PATCH /rest/v1/nfc_tags {"term_end":"2099-01-01"}` succeeded on any row the
 * caller owned — and `account_live_identities` reads `term_end` and `status`, so
 * that one request defeated renewals (D-018), the grace window and the publish
 * slot count (D-022) at once. If a future migration re-grants either column,
 * this fails here rather than in production.
 */
const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/0020_nfc_tags_column_grants.sql"),
  "utf8",
);

/** Strips SQL line comments so prose about a rule cannot pass for the rule. */
const CODE = SQL.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("the column grant — the bypass this closes", () => {
  it("revokes the table-wide write from authenticated", () => {
    expect(CODE).toMatch(
      /revoke insert, update, delete on public\.nfc_tags from authenticated/i,
    );
  });

  it("grants back label and nothing else", () => {
    expect(CODE).toMatch(/grant update \(label\) on public\.nfc_tags to authenticated/i);

    // One grant statement against this table, so a second column cannot be
    // slipped in alongside the first and go unnoticed.
    const grants = CODE.match(/grant update \([^)]*\) on public\.nfc_tags/gi) ?? [];
    expect(grants).toHaveLength(1);
  });

  /**
   * Named individually rather than relying on the count above, because these
   * four are the ones with money or entitlement behind them and a future
   * migration is most likely to re-grant them by reflex.
   */
  it.each(["term_end", "term_start", "status", "account_id"])(
    "never grants %s to authenticated",
    (column) => {
      const grants = CODE.match(/grant update \([^)]*\) on public\.nfc_tags/gi) ?? [];
      for (const grant of grants) expect(grant).not.toContain(column);
    },
  );

  it("revokes before it grants, or the grant is undone", () => {
    const revoke = CODE.indexOf("revoke insert, update, delete on public.nfc_tags");
    const grant = CODE.indexOf("grant update (label) on public.nfc_tags");
    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(-1);
    expect(revoke).toBeLessThan(grant);
  });
});

describe("rebind_tag — the write path the grant displaces", () => {
  it("is security definer with a pinned search_path", () => {
    expect(CODE).toMatch(
      /create or replace function public\.rebind_tag[\s\S]*?security definer[\s\S]*?set search_path = public/i,
    );
  });

  /**
   * D-021. This rule used to live in TypeScript above a direct table write; if
   * it had been left there, narrowing the grant would have moved the write into
   * SQL and left the rule behind.
   */
  it("refuses a page that is not published", () => {
    expect(CODE).toMatch(/page_not_published/);
  });

  it("refuses a tag the caller does not own", () => {
    expect(CODE).toMatch(
      /from public\.nfc_tags\s+where id = p_tag_id and account_id = v_account/i,
    );
  });

  it("refuses a page on another account", () => {
    expect(CODE).toMatch(
      /from public\.smart_pages\s+where id = p_page_id and account_id = v_account/i,
    );
  });

  it("is callable by a signed-in customer", () => {
    expect(CODE).toMatch(
      /grant execute on function public\.rebind_tag\(uuid, uuid\) to authenticated/i,
    );
  });
});

describe("set_tag_status", () => {
  /**
   * `unassigned` is a minting state. A customer who could reach it would be
   * un-owning their own card, and the identity is the billing unit (D-018).
   */
  it("accepts assigned and disabled only", () => {
    expect(CODE).toMatch(/p_status not in \('assigned', 'disabled'\)/i);
  });

  it("scopes the update to the caller's own account", () => {
    expect(CODE).toMatch(/where id = p_tag_id and account_id = v_account/i);
  });
});

describe("replace_tag carries the term", () => {
  /**
   * 0010 copied smart_page_id and nothing else, so a replacement landed with
   * term_end NULL — which identity_is_live() treats as live forever. Replacing a
   * card turned a term that expires into one that does not.
   */
  it.each(["term_start", "term_end", "kind"])("copies %s from the old card", (column) => {
    const fn = CODE.slice(CODE.indexOf("create or replace function public.replace_tag"));
    expect(fn).toMatch(new RegExp(`${column}\\s*=\\s*v_old\\.${column}`, "i"));
  });

  it("still disables the card being replaced", () => {
    const fn = CODE.slice(CODE.indexOf("create or replace function public.replace_tag"));
    expect(fn).toMatch(/set status = 'disabled'\s+where id = v_old\.id/i);
  });

  it("still refuses a replacement owned by someone else", () => {
    expect(CODE).toMatch(/replacement card already belongs to another account/);
  });
});

describe("what this migration must not do", () => {
  it("drops nothing", () => {
    expect(CODE).not.toMatch(/drop table/i);
    expect(CODE).not.toMatch(/drop column/i);
  });

  /**
   * The policies on nfc_tags are correct — they control which ROWS, which is the
   * half that was never the problem. A permissions fix that rewrote them would
   * be changing the wrong thing.
   */
  it("leaves the row-level policies alone", () => {
    expect(CODE).not.toMatch(/create policy/i);
    expect(CODE).not.toMatch(/drop policy/i);
  });
});
