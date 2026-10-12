import { afterEach, describe, expect, it, vi } from "vitest";
import { composeFirstTapPush, composeLeadPush, composeTermPush, pushCardName, sendPush } from "./push";

describe("what a notification says", () => {
  it("announces a lead without the customer's name or number (question 11)", () => {
    const m = composeLeadPush({ leadId: "l1", profileTitle: "Mama Njeri's Kitchen" });
    expect(m).toEqual({
      title: "New lead",
      body: "Someone left their details on Mama Njeri's Kitchen.",
      data: { kind: "lead", id: "l1" },
      channelId: "leads",
    });
    expect(composeLeadPush({ leadId: "l1", profileTitle: null }).body).toBe("Someone left their details on your profile.");
  });

  it("says a card went live, naming it as its owner does", () => {
    expect(composeFirstTapPush({ cardId: "c1", cardName: "Reception" })).toMatchObject({
      title: "Your card is live",
      body: "‘Reception’ was tapped for the first time.",
      data: { kind: "first_tap", id: "c1" },
      channelId: "cards",
    });
    expect(composeFirstTapPush({ cardId: "c1", cardName: pushCardName({ kind: "card" }) }).body).toBe(
      "Your card was tapped for the first time.",
    );
    expect(pushCardName({ label: "  Till ", kind: "stand" })).toBe("Till");
    expect(pushCardName({ kind: "stand" })).toBe("Your stand");
  });

  it.each([
    ["T30", "2026-12-31T00:00:00Z", "‘Reception’ is active until 31 Dec 2026."],
    ["T7", "2026-12-31T00:00:00Z", "‘Reception’ is active until 31 Dec 2026."],
    ["T0", "2026-12-31T00:00:00Z", "‘Reception’: term ended 31 Dec 2026. Still working until 14 Jan 2027."],
    ["stopped", "2026-12-31T00:00:00Z", "‘Reception’ is no longer active."],
  ] as const)("words the %s term notice neutrally (PLAN.md §3)", (milestone, termEnd, body) => {
    const m = composeTermPush({ cardId: "c1", cardName: "Reception", termEnd, milestone });
    expect(m.body).toBe(body);
    expect(m.data).toEqual({ kind: "term", id: "c1" });
    expect(`${m.title} ${m.body}`).not.toMatch(/renew|pay|buy|KES|price|subscri|http/i);
  });
});

describe("sendPush", () => {
  afterEach(() => vi.unstubAllEnvs());

  const message = composeLeadPush({ leadId: "l1", profileTitle: "Shop" });
  const respond = (body: unknown, status = 200) =>
    vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));

  it("sends each phone the message, high priority for leads, and counts what Expo accepted", async () => {
    vi.stubEnv("EXPO_ACCESS_TOKEN", "example-expo-token");
    const fetcher = respond({ data: [{ status: "ok", id: "t1" }, { status: "ok", id: "t2" }] });
    const result = await sendPush(["ExpoPushToken[a]", "ExpoPushToken[b]"], message, fetcher as unknown as typeof fetch);
    expect(result).toEqual({ sent: 2, failed: 0, goneTokens: [], errors: [] });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer example-expo-token" });
    const body = JSON.parse(String(init?.body));
    expect(body[0]).toMatchObject({ to: "ExpoPushToken[a]", title: "New lead", channelId: "leads", priority: "high", data: { kind: "lead", id: "l1" } });
  });

  it("reports phones the app was removed from, so they are forgotten", async () => {
    const fetcher = respond({
      data: [
        { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
        { status: "error", message: "Message too big", details: { error: "MessageTooBig" } },
        { status: "ok", id: "t3" },
      ],
    });
    const result = await sendPush(["ExpoPushToken[a]", "ExpoPushToken[b]", "ExpoPushToken[c]"], message, fetcher as unknown as typeof fetch);
    expect(result).toEqual({ sent: 1, failed: 2, goneTokens: ["ExpoPushToken[a]"], errors: ["Message too big"] });
  });

  it("sends in batches of 100", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const n = JSON.parse(String(init?.body)).length;
      return new Response(JSON.stringify({ data: Array.from({ length: n }, () => ({ status: "ok", id: "x" })) }));
    });
    const tokens = Array.from({ length: 250 }, (_, i) => `ExpoPushToken[${i}]`);
    const result = await sendPush(tokens, message, fetcher as unknown as typeof fetch);
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).length)).toEqual([100, 100, 50]);
    expect(result.sent).toBe(250);
  });

  it("never throws: a refused request or no connection is counted as failed", async () => {
    const refused = await sendPush(["ExpoPushToken[a]"], message, respond({ errors: [{ message: "Unauthorized" }] }, 401) as unknown as typeof fetch);
    expect(refused).toEqual({ sent: 0, failed: 1, goneTokens: [], errors: ["Unauthorized"] });
    const offline = await sendPush(["ExpoPushToken[a]"], message, (async () => {
      throw new Error("fetch failed");
    }) as unknown as typeof fetch);
    expect(offline).toEqual({ sent: 0, failed: 1, goneTokens: [], errors: ["fetch failed"] });
  });

  it("sends without the access header when none is configured", async () => {
    vi.stubEnv("EXPO_ACCESS_TOKEN", "");
    const fetcher = respond({ data: [{ status: "ok", id: "t1" }] });
    await sendPush(["ExpoPushToken[a]"], message, fetcher as unknown as typeof fetch);
    expect((fetcher.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
