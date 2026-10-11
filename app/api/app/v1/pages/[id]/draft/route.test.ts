import { beforeEach, describe, expect, it, vi } from "vitest";

const requestUser = vi.fn();
vi.mock("@/lib/api/request-user", () => ({ requestUser: (...a: unknown[]) => requestUser(...a) }));
const saveDraft = vi.fn();
vi.mock("@/lib/page-draft", () => ({ saveDraft: (...a: unknown[]) => saveDraft(...a) }));

const { PUT } = await import("./route");

const PAGE = "9b2f6a1c-3d4e-4f50-8a6b-7c8d9e0f1a2b";
const ACTION = "3f6c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f";
const supabase = { marker: "user-scoped client" };

const draft = {
  expectedUpdatedAt: "2026-10-11T14:00:00.123456+00:00",
  title: "Mama Mboga",
  config: {},
  theme: {},
  blocks: [{ id: ACTION, type: "call", label: "Call", value: "0722000000", isActive: true }],
};

function put(body: unknown, id = PAGE, headers: Record<string, string> = {}) {
  const request = new Request(`https://taptap.example/api/app/v1/pages/${id}/draft`, {
    method: "PUT",
    headers: { authorization: "Bearer example-access-token", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ id }) });
}

async function answer(response: Response) {
  return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
}

beforeEach(() => {
  requestUser.mockReset();
  requestUser.mockResolvedValue({ user: { id: "user-1" }, supabase });
  saveDraft.mockReset();
});

describe("PUT /api/app/v1/pages/{id}/draft", () => {
  it("saves as the signed-in user and returns the new version", async () => {
    saveDraft.mockResolvedValue({ ok: true, updatedAt: "v2" });
    await expect(answer(await put(draft))).resolves.toEqual({
      status: 200,
      body: { updatedAt: "v2" },
      cache: "no-store",
    });
    const [client, id, input] = saveDraft.mock.calls[0];
    expect(client).toBe(supabase);
    expect(id).toBe(PAGE);
    expect(input).toMatchObject({ ...draft, mode: undefined });
  });

  it("never lets the app switch a profile's type", async () => {
    saveDraft.mockResolvedValue({ ok: true, updatedAt: "v2" });
    await put({ ...draft, mode: "redirect", redirectUrl: "https://x.co" });
    expect(saveDraft.mock.calls[0][2].mode).toBeUndefined();
  });

  it("refuses a request without a valid token", async () => {
    requestUser.mockResolvedValue(null);
    expect((await answer(await put(draft))).status).toBe(401);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("treats an id that is not a uuid as not found", async () => {
    const res = await answer(await put(draft, "acme"));
    expect(res).toMatchObject({ status: 404, body: { code: "not_found" } });
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("refuses a body that is not a draft, naming the field", async () => {
    expect(await answer(await put("{not json"))).toMatchObject({
      status: 400,
      body: { code: "invalid_body", field: "body" },
    });
    expect(await answer(await put({ ...draft, blocks: [{ id: "x" }] }))).toMatchObject({
      status: 400,
      body: { code: "invalid_body", field: "blocks[0].id" },
    });
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("refuses an oversized body before reading it", async () => {
    const res = await put(draft, PAGE, { "content-length": String(10 * 1024 * 1024) });
    expect(res.status).toBe(400);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, code: "conflict", updatedAt: "v9" }, 409, { code: "conflict", updatedAt: "v9" }],
    [{ ok: false, code: "not_found" }, 404, { code: "not_found" }],
    [{ ok: false, code: "invalid_destination", index: 2 }, 422, { code: "invalid_destination", index: 2 }],
    [{ ok: false, code: "invalid_redirect" }, 422, { code: "invalid_redirect" }],
    [{ ok: false, code: "invalid_block" }, 422, { code: "invalid_block" }],
    [{ ok: false, code: "schema_pending" }, 503, { code: "unavailable" }],
  ])("maps %j to %i", async (result, status, body) => {
    saveDraft.mockResolvedValue(result);
    expect(await answer(await put(draft))).toMatchObject({ status, body });
  });

  it("hides database errors from the response", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    saveDraft.mockResolvedValue({ ok: false, code: "error", message: "relation secret_table" });
    const res = await answer(await put(draft));
    expect(res).toMatchObject({ status: 500, body: { code: "error" } });
    expect(JSON.stringify(res.body)).not.toContain("secret_table");
    error.mockRestore();
  });
});
