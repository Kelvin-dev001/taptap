import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const createClient = vi.fn((..._args: unknown[]) => ({ auth: { getUser } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

const { bearerToken, requestUser } = await import("./request-user");

const req = (authorization?: string) =>
  new Request("https://taptap.example/api/app/v1/x", {
    headers: authorization === undefined ? {} : { authorization },
  });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");
  getUser.mockReset();
  createClient.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("bearerToken", () => {
  it("reads the token from a Bearer header", () => {
    expect(bearerToken(req("Bearer abc.def-ghi_jkl"))).toBe("abc.def-ghi_jkl");
    expect(bearerToken(req("bearer   abc.def"))).toBe("abc.def");
  });

  it("ignores anything else", () => {
    expect(bearerToken(req())).toBeNull();
    expect(bearerToken(req("Basic dXNlcjpwYXNz"))).toBeNull();
    expect(bearerToken(req("Bearer"))).toBeNull();
    expect(bearerToken(req("Bearer two words"))).toBeNull();
  });
});

describe("requestUser", () => {
  it("refuses a request without a token, without asking Supabase", async () => {
    await expect(requestUser(req())).resolves.toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("asks Supabase Auth about the token and returns a client that acts as the user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const result = await requestUser(req("Bearer example-access-token"));

    expect(getUser).toHaveBeenCalledWith("example-access-token");
    expect(result?.user).toEqual({ id: "user-1" });
    const [url, key, options] = createClient.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(url).toBe("https://project.supabase.co");
    expect(key).toBe("public-anon-key");
    expect(options).toMatchObject({
      global: { headers: { Authorization: "Bearer example-access-token" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it("refuses a token Supabase rejects (expired, signed out, deleted user)", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid JWT" } });
    await expect(requestUser(req("Bearer example-expired-token"))).resolves.toBeNull();
  });

  it("fails loudly when the server is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(requestUser(req("Bearer example-access-token"))).rejects.toThrow(/not configured/);
  });
});
