import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Server-side publish enforcement, asserted against the migration itself.
 *
 * Unusual, and deliberate. The rule that actually stops someone publishing
 * without paying lives in SQL, not TypeScript, so a test suite that only
 * exercises `lib/entitlement.ts` would pass in full while the product gave every
 * page away. These assertions are about the SQL text because the SQL text is the
 * enforcement.
 *
 * The one they exist for above all: `authenticated` held a table-wide UPDATE
 * grant on `smart_pages` from 0001 until Sprint 7, which meant
 * `PATCH /rest/v1/smart_pages {"status":"published"}` published anything the
 * caller owned, whatever publish_page() said. If a future migration re-grants
 * `status`, this fails here rather than in production.
 */
const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/0019_publish_entitlement.sql"),
  "utf8",
);

/** Strips SQL line comments so prose about a rule cannot pass for the rule. */
const CODE = SQL.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("grandfathering", () => {
  /**
   * The statement that stops this sprint from breaking every existing customer.
   * Its absence would silently unpublish everyone who is live today.
   */
  it("flags every page that is already published", () => {
    expect(CODE).toMatch(
      /update\s+public\.smart_pages\s+set\s+entitlement_grandfathered\s*=\s*true\s+where\s+status\s*=\s*'published'/i,
    );
  });

  /**
   * Ordering is load-bearing: the backfill must run BEFORE the trigger exists,
   * or the rule it exempts people from could refuse to exempt them.
   */
  it("runs the backfill before the enforcement trigger is created", () => {
    const backfill = CODE.indexOf("entitlement_grandfathered = true");
    const trigger = CODE.indexOf("create trigger smart_pages_enforce_publish");
    expect(backfill).toBeGreaterThan(-1);
    expect(trigger).toBeGreaterThan(-1);
    expect(backfill).toBeLessThan(trigger);
  });

  it("does not drop or rename the column it depends on", () => {
    expect(CODE).toMatch(/add column if not exists entitlement_grandfathered/i);
    expect(CODE).not.toMatch(/drop column .*entitlement_grandfathered/i);
  });
});

describe("new pages are private", () => {
  it("changes the status default from published to draft", () => {
    expect(CODE).toMatch(
      /alter table public\.smart_pages\s+alter column status set default 'draft'/i,
    );
  });
});

describe("the column grant — the bypass this closes", () => {
  it("revokes the table-wide insert and update from authenticated", () => {
    expect(CODE).toMatch(
      /revoke insert, update on public\.smart_pages from authenticated/i,
    );
  });

  /**
   * The heart of it. Every column the app legitimately writes is granted back;
   * the four that decide whether a page is public are not, so only the SECURITY
   * DEFINER RPCs and the service role can set them.
   */
  it("never grants a publish column back", () => {
    const grants = CODE.match(/grant (?:insert|update)\s*\(([^)]*)\)\s*\n?\s*on public\.smart_pages/gi);
    expect(grants).not.toBeNull();

    const granted = (grants ?? []).join(" ");
    for (const column of [
      "status",
      "published_at",
      "published_content",
      "entitlement_grandfathered",
    ]) {
      expect(granted).not.toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  /** And the columns the editor genuinely needs must survive the narrowing. */
  it("keeps every column the app actually writes", () => {
    for (const column of ["title", "mode", "redirect_url", "config", "theme", "is_active"]) {
      expect(CODE).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });
});

describe("publish_page", () => {
  it("refuses when the account has no slot", () => {
    const fn = CODE.slice(
      CODE.indexOf("function public.publish_page"),
      CODE.indexOf("function public.enforce_publish_entitlement"),
    );
    expect(fn).toMatch(/if not public\.page_publish_allowed\(p_page_id\)/i);
    expect(fn).toMatch(/insufficient_entitlement/);
  });

  it("still checks ownership as well as entitlement", () => {
    const fn = CODE.slice(
      CODE.indexOf("function public.publish_page"),
      CODE.indexOf("function public.enforce_publish_entitlement"),
    );
    expect(fn).toMatch(/account_id = v_account/);
  });
});

describe("the trigger", () => {
  it("fires before an update that turns a page public", () => {
    expect(CODE).toMatch(/before update on public\.smart_pages/i);
    expect(CODE).toMatch(
      /new\.status = 'published' and old\.status is distinct from 'published'/i,
    );
  });

  it("raises the same code the application matches on", () => {
    const fn = CODE.slice(CODE.indexOf("function public.enforce_publish_entitlement"));
    expect(fn).toMatch(/raise exception 'insufficient_entitlement'/);
  });
});

describe("what the public sees", () => {
  it("makes page_is_live depend on owning a live identity", () => {
    const fn = CODE.slice(
      CODE.indexOf("function public.page_is_live"),
      CODE.indexOf("function public.claim_tag"),
    );
    expect(fn).toMatch(/account_live_identities/);
    expect(fn).toMatch(/entitlement_grandfathered/);
  });

  /**
   * Deterministic ordering. Without it, which of an account's pages goes dark
   * when an identity lapses would depend on row order, which is a race.
   */
  it("orders by publication time so the outcome is a fact, not a race", () => {
    const fn = CODE.slice(
      CODE.indexOf("function public.page_is_live"),
      CODE.indexOf("function public.claim_tag"),
    );
    expect(fn).toMatch(/published_at/);
    expect(fn).toMatch(/sp\.id <= p\.id/);
  });
});

describe("claim_tag", () => {
  it("refuses to bind a card to a draft", () => {
    const fn = CODE.slice(
      CODE.indexOf("function public.claim_tag"),
      CODE.indexOf("function public.account_has_custom_branding"),
    );
    expect(fn).toMatch(/v_page_status <> 'published'/);
    expect(fn).toMatch(/page_not_published/);
  });

  it("keeps every check it already had", () => {
    const fn = CODE.slice(
      CODE.indexOf("function public.claim_tag"),
      CODE.indexOf("function public.account_has_custom_branding"),
    );
    expect(fn).toMatch(/tag is disabled/);
    expect(fn).toMatch(/tag already claimed/);
    expect(fn).toMatch(/for update/);
  });
});

describe("no free plan is left behind", () => {
  /** The last live remnant: signup wrote subscriptions(plan='free') every time. */
  it("stops the signup trigger writing a free plan", () => {
    const fn = CODE.slice(CODE.indexOf("function public.handle_new_user"));
    expect(fn).not.toMatch(/insert into public\.subscriptions/i);
    expect(fn).not.toMatch(/'free'/);
  });

  it("still provisions the account and profile it always did", () => {
    const fn = CODE.slice(CODE.indexOf("function public.handle_new_user"));
    expect(fn).toMatch(/insert into public\.accounts/i);
    expect(fn).toMatch(/insert into public\.profiles/i);
  });

  /**
   * `subscriptions` and `accounts.segment` hold real historical data. Dropping
   * either in the same migration that changes entitlement means a rollback
   * loses it, so both are left in place and simply unread (D-024).
   */
  it("drops no table or column that still holds data", () => {
    expect(CODE).not.toMatch(/drop table/i);
    expect(CODE).not.toMatch(/drop column/i);
  });
});

describe("RLS is never weakened", () => {
  /**
   * §30.6. Removing the free plan must not loosen a single policy, so the only
   * permission changes in this migration are narrowing ones plus the additive
   * policies for the new table.
   */
  it("adds policies only for the table it introduces", () => {
    const policies = CODE.match(/create policy (\w+)/gi) ?? [];
    for (const p of policies) {
      expect(p).toMatch(/quote_requests/i);
    }
  });

  it("enables row level security on the new table", () => {
    expect(CODE).toMatch(
      /alter table public\.quote_requests enable row level security/i,
    );
  });

  /** Public submissions go through a definer function, never a direct insert. */
  it("gives anon no direct insert on quote_requests", () => {
    expect(CODE).not.toMatch(/create policy .*quote_requests.*\n\s*for insert/i);
    expect(CODE).toMatch(/function public\.submit_quote_request/);
  });
});
