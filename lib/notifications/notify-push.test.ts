import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const sendPush = vi.fn();
vi.mock("./push", async () => {
  const actual = await vi.importActual<typeof import("./push")>("./push");
  return { ...actual, sendPush: (...a: unknown[]) => sendPush(...a) };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { pushFirstTap, pushNewLead, pushTerm } = await import("./notify-push");

type Inserted = Record<string, unknown>;

function fakeAdmin(opts: {
  tokens?: string[];
  leadTarget?: unknown;
  tag?: unknown;
  claimError?: { code: string; message: string } | null;
}) {
  const inserted: Inserted[] = [];
  const updates: { patch: unknown; filters: [string, unknown][] }[] = [];
  const rpcs: [string, unknown][] = [];
  const admin = {
    rpc: async (name: string, args: unknown) => {
      rpcs.push([name, args]);
      if (name === "push_targets") return { data: opts.tokens ?? [], error: null };
      if (name === "lead_notification_target") return { data: opts.leadTarget ?? null, error: null };
      return { data: 0, error: null };
    },
    from: (table: string) => {
      if (table === "nfc_tags") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.tag ?? null, error: null }) }) }) };
      }
      return {
        insert: async (row: Inserted) => {
          inserted.push(row);
          return { error: opts.claimError ?? null };
        },
        update: (patch: unknown) => {
          const entry = { patch, filters: [] as [string, unknown][] };
          updates.push(entry);
          const chain = {
            eq: (col: string, value: unknown) => {
              entry.filters.push([col, value]);
              return chain;
            },
            then: (resolve: (v: unknown) => void) => resolve({ error: null }),
          };
          return chain;
        },
      };
    },
  };
  return { admin: admin as unknown as SupabaseClient, inserted, updates, rpcs };
}

beforeEach(() => sendPush.mockReset());

describe("pushNewLead", () => {
  it("claims the send, then pushes every phone that wants leads", async () => {
    sendPush.mockResolvedValue({ sent: 2, failed: 0, goneTokens: [], errors: [] });
    const f = fakeAdmin({ tokens: ["ExpoPushToken[a]", "ExpoPushToken[b]"], leadTarget: { accountId: "acct", pageTitle: "Shop" } });
    await expect(pushNewLead("lead-1", f.admin)).resolves.toEqual({ status: "sent", phones: 2 });

    expect(f.rpcs).toContainEqual(["push_targets", { p_account_id: "acct", p_kind: "lead" }]);
    expect(f.inserted[0]).toMatchObject({ account_id: "acct", kind: "lead", ref_id: "lead-1", channel: "push" });
    const [tokens, message] = sendPush.mock.calls[0];
    expect(tokens).toEqual(["ExpoPushToken[a]", "ExpoPushToken[b]"]);
    expect(message).toMatchObject({ title: "New lead", body: "Someone left their details on Shop." });
    expect(f.updates[0]).toMatchObject({ patch: { status: "sent", error: null } });
  });

  it("does nothing, and claims nothing, when no phone wants it", async () => {
    const f = fakeAdmin({ tokens: [], leadTarget: { accountId: "acct", pageTitle: "Shop" } });
    await expect(pushNewLead("lead-1", f.admin)).resolves.toEqual({ status: "skipped", reason: "no phone wants it" });
    expect(f.inserted).toEqual([]);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("stops if another request already claimed this lead", async () => {
    const f = fakeAdmin({
      tokens: ["ExpoPushToken[a]"],
      leadTarget: { accountId: "acct", pageTitle: null },
      claimError: { code: "23505", message: "duplicate" },
    });
    await expect(pushNewLead("lead-1", f.admin)).resolves.toEqual({ status: "skipped", reason: "already notified" });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("forgets phones Expo reports as gone", async () => {
    sendPush.mockResolvedValue({ sent: 1, failed: 1, goneTokens: ["ExpoPushToken[old]"], errors: [] });
    const f = fakeAdmin({ tokens: ["ExpoPushToken[a]", "ExpoPushToken[old]"], leadTarget: { accountId: "acct", pageTitle: "Shop" } });
    await pushNewLead("lead-1", f.admin);
    expect(f.rpcs).toContainEqual(["forget_push_tokens", { p_tokens: ["ExpoPushToken[old]"] }]);
    expect(f.updates[0].patch).toEqual({ status: "sent", error: "1 of 2 failed" });
  });

  it("never throws", async () => {
    const broken = { rpc: async () => { throw new Error("db down"); } } as unknown as SupabaseClient;
    await expect(pushNewLead("lead-1", broken)).resolves.toEqual({ status: "failed", error: "db down" });
  });
});

describe("pushFirstTap", () => {
  it("names the card and opens it", async () => {
    sendPush.mockResolvedValue({ sent: 1, failed: 0, goneTokens: [], errors: [] });
    const f = fakeAdmin({ tokens: ["ExpoPushToken[a]"], tag: { id: "card-1", label: "Reception", kind: "card", account_id: "acct" } });
    await pushFirstTap("card-1", "order-1", f.admin);
    expect(f.inserted[0]).toMatchObject({ kind: "first_tap", ref_id: "order-1", channel: "push" });
    expect(sendPush.mock.calls[0][1]).toMatchObject({ body: "‘Reception’ was tapped for the first time.", data: { kind: "first_tap", id: "card-1" } });
  });
});

describe("pushTerm", () => {
  it("dedupes by the email's term-aware key plus ':push', so the two channels never collide", async () => {
    sendPush.mockResolvedValue({ sent: 1, failed: 0, goneTokens: [], errors: [] });
    const f = fakeAdmin({ tokens: ["ExpoPushToken[a]"] });
    await pushTerm(f.admin, "acct", { id: "card-1", label: "Till", termEnd: "2026-12-31T00:00:00Z" }, "T7");
    expect(f.inserted[0]).toMatchObject({
      kind: "renewal_T7",
      ref_id: "card-1",
      channel: "push",
      dedupe_key: "renewal:card-1:2026-12-31:T7:push",
    });
    expect(f.rpcs).toContainEqual(["push_targets", { p_account_id: "acct", p_kind: "term" }]);
    expect(f.updates[0].filters).toEqual([["dedupe_key", "renewal:card-1:2026-12-31:T7:push"]]);
  });
});
