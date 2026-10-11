import { callAppApi, NetworkError, NotSignedInError } from "./app-api";

const mockGetSession = jest.fn();
jest.mock("./supabase", () => ({ supabase: { auth: { getSession: () => mockGetSession() } } }));
jest.mock("@/config/env", () => ({ env: { siteUrl: "https://taptap.example" } }));

const signedIn = { data: { session: { access_token: "example-access-token" } } };

function respond(status: number, body: string) {
  return jest.fn(async () => new Response(body, { status }));
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue(signedIn);
});

describe("callAppApi", () => {
  it("sends JSON to the website with the session's token as a Bearer header", async () => {
    const fetcher = respond(200, JSON.stringify({ updatedAt: "v2" }));
    const answer = await callAppApi("PUT", "/api/app/v1/pages/p1/draft", { title: "x" }, fetcher);

    expect(answer).toEqual({ status: 200, body: { updatedAt: "v2" } });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://taptap.example/api/app/v1/pages/p1/draft");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ title: "x" }));
    expect(init.headers).toMatchObject({
      Authorization: "Bearer example-access-token",
      "Content-Type": "application/json",
    });
  });

  it("returns error answers rather than throwing, body and all", async () => {
    const answer = await callAppApi("PUT", "/x", {}, respond(409, JSON.stringify({ code: "conflict", updatedAt: "v9" })));
    expect(answer).toEqual({ status: 409, body: { code: "conflict", updatedAt: "v9" } });
  });

  it("copes with a body that is not JSON", async () => {
    await expect(callAppApi("PUT", "/x", {}, respond(502, "<html>Bad gateway</html>"))).resolves.toEqual({
      status: 502,
      body: {},
    });
    await expect(callAppApi("PUT", "/x", {}, respond(200, "[1,2]"))).resolves.toEqual({ status: 200, body: {} });
  });

  it("refuses to send anything without a session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const fetcher = respond(200, "{}");
    await expect(callAppApi("PUT", "/x", {}, fetcher)).rejects.toBeInstanceOf(NotSignedInError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports a request that never got an answer as offline", async () => {
    const fetcher = jest.fn(async () => {
      throw new TypeError("Network request failed");
    });
    await expect(callAppApi("PUT", "/x", {}, fetcher)).rejects.toEqual(new NetworkError("offline"));
  });

  it("gives up after 15 seconds and says so", async () => {
    jest.useFakeTimers();
    try {
      const fetcher = jest.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      );
      const call = callAppApi("PUT", "/x", {}, fetcher as unknown as typeof fetch);
      const outcome = expect(call).rejects.toMatchObject({ reason: "timeout" });
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(15_000);
      await outcome;
    } finally {
      jest.useRealTimers();
    }
  });
});
