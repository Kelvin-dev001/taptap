import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAccount, FRESH_SIGN_IN_SECONDS, signedInRecently } from "./account-deletion";

const NOW = 1_800_000_000;
const token = (claims: unknown) =>
  `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;

describe("signedInRecently", () => {
  it("accepts a sign-in within ten minutes, by password or by code", () => {
    expect(signedInRecently(token({ amr: [{ method: "password", timestamp: NOW - 60 }] }), NOW)).toBe(true);
    expect(signedInRecently(token({ amr: [{ method: "otp", timestamp: NOW - FRESH_SIGN_IN_SECONDS }] }), NOW)).toBe(true);
  });

  it("uses the latest of several sign-ins", () => {
    const amr = [
      { method: "password", timestamp: NOW - 86_400 },
      { method: "otp", timestamp: NOW - 30 },
    ];
    expect(signedInRecently(token({ amr }), NOW)).toBe(true);
  });

  it("refuses an old sign-in, even with a freshly refreshed token", () => {
    expect(
      signedInRecently(token({ iat: NOW - 5, amr: [{ method: "password", timestamp: NOW - FRESH_SIGN_IN_SECONDS - 1 }] }), NOW),
    ).toBe(false);
  });

  it("refuses tokens without sign-in times, and anything malformed", () => {
    expect(signedInRecently(token({ iat: NOW }), NOW)).toBe(false);
    expect(signedInRecently(token({ amr: "password" }), NOW)).toBe(false);
    expect(signedInRecently("not-a-jwt", NOW)).toBe(false);
    expect(signedInRecently("a.!!!.c", NOW)).toBe(false);
    // A sign-in "in the future" beyond clock skew is not trusted.
    expect(signedInRecently(token({ amr: [{ method: "password", timestamp: NOW + 3600 }] }), NOW)).toBe(false);
  });
});

function fakeAdmin(rpc: { data?: unknown; error?: { code?: string; message: string } | null }, opts: { authError?: string } = {}) {
  const calls: string[] = [];
  const removed: string[][] = [];
  const tree: Record<string, { name: string; id: string | null }[]> = {
    acct: [
      { name: "page-1", id: null },
      { name: "page-2", id: null },
    ],
    "acct/page-1": [
      { name: "avatar-1.jpg", id: "f1" },
      { name: "cover-1.jpg", id: "f2" },
    ],
    "acct/page-2": [{ name: "avatar-2.jpg", id: "f3" }],
  };
  const admin = {
    rpc: async (name: string, args: unknown) => {
      calls.push(`rpc:${name}:${JSON.stringify(args)}`);
      return { data: rpc.data ?? null, error: rpc.error ?? null };
    },
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string) => {
          calls.push(`list:${bucket}:${folder}`);
          return { data: tree[folder] ?? [], error: null };
        },
        remove: async (paths: string[]) => {
          calls.push(`remove:${paths.length}`);
          removed.push(paths);
          return { error: null };
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: vi.fn(async (id: string) => {
          calls.push(`deleteUser:${id}`);
          return { error: opts.authError ? { message: opts.authError } : null };
        }),
      },
    },
  };
  return { admin: admin as unknown as SupabaseClient, calls, removed };
}

describe("deleteAccount", () => {
  it("empties the account, removes its photos, then deletes the sign-in", async () => {
    const { admin, calls, removed } = fakeAdmin({ data: { scope: "account", account_id: "acct" } });
    await expect(deleteAccount(admin, "user-1")).resolves.toEqual({ ok: true, scope: "account", photosRemoved: 3 });
    expect(calls[0]).toBe('rpc:delete_account:{"p_user_id":"user-1"}');
    expect(removed.flat().sort()).toEqual(["acct/page-1/avatar-1.jpg", "acct/page-1/cover-1.jpg", "acct/page-2/avatar-2.jpg"]);
    expect(calls[calls.length - 1]).toBe("deleteUser:user-1");
  });

  it("removes only the person from a shared account, and no photos", async () => {
    const { admin, calls } = fakeAdmin({ data: { scope: "member" } });
    await expect(deleteAccount(admin, "user-2")).resolves.toEqual({ ok: true, scope: "member", photosRemoved: 0 });
    expect(calls.some((c) => c.startsWith("list:"))).toBe(false);
    expect(calls[calls.length - 1]).toBe("deleteUser:user-2");
  });

  it.each([
    [{ code: "P0001", message: "staff_account" }, "staff"],
    [{ code: "P0001", message: "no_account" }, "not_found"],
    [{ code: "PGRST202", message: "Could not find the function" }, "schema_pending"],
    [{ code: "57014", message: "timeout" }, "error"],
  ])("stops before touching the sign-in when the database refuses (%j)", async (error, code) => {
    const { admin, calls } = fakeAdmin({ error });
    const result = await deleteAccount(admin, "user-3");
    expect(result).toMatchObject({ ok: false, code });
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("reports a failed sign-in deletion so the person can retry", async () => {
    const { admin } = fakeAdmin({ data: { scope: "account", account_id: "acct" } }, { authError: "boom" });
    await expect(deleteAccount(admin, "user-4")).resolves.toEqual({ ok: false, code: "error", message: "boom" });
  });
});
