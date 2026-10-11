import { beforeEach, describe, expect, it, vi } from "vitest";

const requestUser = vi.fn();
vi.mock("@/lib/api/request-user", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/request-user")>("@/lib/api/request-user");
  return { ...actual, requestUser: (...a: unknown[]) => requestUser(...a) };
});
const deleteAccount = vi.fn();
vi.mock("@/lib/account-deletion", async () => {
  const actual = await vi.importActual<typeof import("@/lib/account-deletion")>("@/lib/account-deletion");
  return { ...actual, deleteAccount: (...a: unknown[]) => deleteAccount(...a) };
});
const admin = { marker: "service role" };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));

const { POST } = await import("./route");

const now = () => Math.floor(Date.now() / 1000);
const jwt = (signedInAgo: number) =>
  `h.${Buffer.from(JSON.stringify({ amr: [{ method: "password", timestamp: now() - signedInAgo }] })).toString("base64url")}.s`;

function post(token = jwt(30), body: unknown = {}) {
  return POST(
    new Request("https://taptap.example/api/app/v1/account/delete", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  requestUser.mockReset();
  requestUser.mockResolvedValue({ user: { id: "user-1" }, supabase: {} });
  deleteAccount.mockReset();
});

describe("POST /api/app/v1/account/delete", () => {
  it("deletes the caller's own account with the service role, after a fresh sign-in", async () => {
    deleteAccount.mockResolvedValue({ ok: true, scope: "account", photosRemoved: 2 });
    const res = await post();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ scope: "account" });
    expect(deleteAccount).toHaveBeenCalledWith(admin, "user-1");
  });

  it("ignores any user id in the body", async () => {
    deleteAccount.mockResolvedValue({ ok: true, scope: "member", photosRemoved: 0 });
    await post(jwt(30), { userId: "someone-else" });
    expect(deleteAccount).toHaveBeenCalledWith(admin, "user-1");
  });

  it("refuses without a valid token", async () => {
    requestUser.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in when the last one was over ten minutes ago", async () => {
    const res = await post(jwt(11 * 60));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "reauthenticate" });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, code: "staff" }, 403, { code: "staff" }],
    [{ ok: false, code: "not_found" }, 404, { code: "not_found" }],
    [{ ok: false, code: "schema_pending" }, 503, { code: "unavailable" }],
  ])("maps %j to %i", async (result, status, body) => {
    deleteAccount.mockResolvedValue(result);
    const res = await post();
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(body);
  });

  it("hides internal errors from the response", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    deleteAccount.mockResolvedValue({ ok: false, code: "error", message: "relation secret" });
    const res = await post();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    error.mockRestore();
  });
});
