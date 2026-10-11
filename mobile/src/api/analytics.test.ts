import { fetchAnalytics } from "./analytics";

const mockRpc = jest.fn();
jest.mock("./supabase", () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: () => undefined } }));

/** get_analytics (0011) as the web reads it. */
const answer = {
  days: 30,
  scope: "account",
  pages: 2,
  totals: { tap: 12, view: 40, scan: 5, click: 9, download: 2, lead: 1, future_event: 99 },
  previous: { view: 20 },
  leads: 1,
  previous_leads: 0,
  daily: [{ date: "2026-10-10", tap: 1, scan: 0, view: 3, click: 1, download: 0, lead: 0 }],
  by_source: [{ source: "nfc", count: 12 }],
  by_device: [{ id: "t1", label: null, token: "abcdef123456", count: 12 }],
  by_country: [{ country: "KE", count: 30 }],
  by_hour: [{ hour: 14, count: 8 }],
  top_blocks: [{ label: "whatsapp", type: "whatsapp", count: 6 }],
  top_pages: [{ id: "p1", slug: "a", title: null, events: 50 }],
};

beforeEach(() => mockRpc.mockReset());

describe("fetchAnalytics", () => {
  it("calls the web's function with the same range and scope", async () => {
    mockRpc.mockResolvedValue({ data: answer, error: null });
    await fetchAnalytics(7, "p1");
    expect(mockRpc).toHaveBeenCalledWith("get_analytics", { p_days: 7, p_page_id: "p1" });
  });

  it("keeps the counts it knows and ignores event types added later", async () => {
    mockRpc.mockResolvedValue({ data: answer, error: null });
    const a = await fetchAnalytics(30, null);
    expect(a.totals).toEqual({ tap: 12, view: 40, scan: 5, click: 9, download: 2, lead: 1 });
    expect(a.previous).toEqual({ view: 20 });
    expect(a.by_device[0].label).toBeNull();
  });

  it("reads missing breakdowns as empty", async () => {
    mockRpc.mockResolvedValue({
      data: { ...answer, daily: null, by_source: null, by_device: null, by_country: null, by_hour: null, top_blocks: null, top_pages: null },
      error: null,
    });
    const a = await fetchAnalytics(30, null);
    expect([a.daily, a.by_source, a.by_device, a.by_country, a.by_hour, a.top_blocks, a.top_pages]).toEqual([
      [], [], [], [], [], [], [],
    ]);
  });

  it("refuses an answer of the wrong shape", async () => {
    mockRpc.mockResolvedValue({ data: { ...answer, totals: [] }, error: null });
    await expect(fetchAnalytics(30, null)).rejects.toThrow(/get_analytics/);
  });
});
