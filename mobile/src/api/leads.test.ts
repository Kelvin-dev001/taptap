import type { Lead } from "@taptap/core/leads";
import {
  fetchLeadCounts,
  fetchLeadPage,
  firstPageOnly,
  LEAD_DAYS,
  LEAD_PAGE_SIZE,
  loadedLeads,
  nextCursor,
  updateLead,
} from "./leads";

const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
jest.mock("./supabase", () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({
      update: (patch: unknown) => {
        mockUpdate(patch);
        return { eq: (...a: unknown[]) => mockEq(...a) };
      },
    }),
  },
}));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: () => undefined } }));

function lead(n: number, overrides: Partial<Lead> = {}): Lead {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    smart_page_id: "p1",
    page_title: "Mama Njeri's",
    page_slug: "mama-njeri",
    name: `Lead ${n}`,
    phone: null,
    email: null,
    company: null,
    message: null,
    status: "new",
    note: null,
    created_at: `2026-10-${String(30 - n).padStart(2, "0")}T09:00:00.123456+00:00`,
    updated_at: null,
    repeat_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockRpc.mockReset();
  mockUpdate.mockReset();
  mockEq.mockReset();
});

describe("paging", () => {
  it("asks for the first page with no cursor, over all time", async () => {
    mockRpc.mockResolvedValue({ data: [lead(1)], error: null });
    await fetchLeadPage({ status: "won", pageId: "p1" }, null);
    expect(mockRpc).toHaveBeenCalledWith("get_leads", {
      p_days: LEAD_DAYS,
      p_page_id: "p1",
      p_status: "won",
      p_limit: LEAD_PAGE_SIZE,
      p_before_created_at: null,
      p_before_id: null,
    });
  });

  it("continues after the last lead of a full page, exactly as the server wrote it", async () => {
    const page = Array.from({ length: LEAD_PAGE_SIZE }, (_, i) => lead(i + 1));
    const cursor = nextCursor(page);
    expect(cursor).toEqual({ createdAt: page[LEAD_PAGE_SIZE - 1].created_at, id: page[LEAD_PAGE_SIZE - 1].id });

    mockRpc.mockResolvedValue({ data: [], error: null });
    await fetchLeadPage({ status: null, pageId: null }, cursor!);
    expect(mockRpc.mock.calls[0][1]).toMatchObject({
      p_before_created_at: cursor!.createdAt,
      p_before_id: cursor!.id,
    });
  });

  it("stops after a short page", () => {
    expect(nextCursor([lead(1), lead(2)])).toBeUndefined();
    expect(nextCursor([])).toBeUndefined();
  });

  it("reads an unknown status as new rather than crashing", async () => {
    mockRpc.mockResolvedValue({ data: [{ ...lead(1), status: "archived" }], error: null });
    const [l] = await fetchLeadPage({ status: null, pageId: null }, null);
    expect(l.status).toBe("new");
  });

  it("refuses an answer of the wrong shape", async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 5 }], error: null });
    await expect(fetchLeadPage({ status: null, pageId: null }, null)).rejects.toThrow(/get_leads/);
  });

  it("refreshes from the first page only", () => {
    const data = { pages: [[lead(1)], [lead(2)], [lead(3)]], pageParams: [null, { createdAt: "a", id: "b" }, { createdAt: "c", id: "d" }] };
    expect(firstPageOnly(data)).toEqual({ pages: [[lead(1)]], pageParams: [null] });
    expect(firstPageOnly(undefined)).toBeUndefined();
  });
});

describe("loadedLeads", () => {
  it("merges every list, newest first, each lead once", () => {
    const all = { pages: [[lead(1), lead(2)], [lead(3)]], pageParams: [] };
    const won = { pages: [[lead(2, { status: "won" })]], pageParams: [] };
    const merged = loadedLeads([all, undefined, won]);
    expect(merged.map((l) => l.name)).toEqual(["Lead 1", "Lead 2", "Lead 3"]);
  });
});

describe("counts", () => {
  it("keeps only known statuses", async () => {
    mockRpc.mockResolvedValue({ data: { all: 7, by_status: { new: 4, won: 3, archived: 2 } }, error: null });
    await expect(fetchLeadCounts(null)).resolves.toEqual({ all: 7, by_status: { new: 4, won: 3 } });
    expect(mockRpc).toHaveBeenCalledWith("get_lead_counts", { p_days: LEAD_DAYS, p_page_id: null });
  });
});

describe("updateLead", () => {
  it("writes only status, note and when — never what the customer sent", async () => {
    mockEq.mockResolvedValue({ error: null });
    await updateLead("l1", { status: "won" });
    const patch = mockUpdate.mock.calls[0][0];
    expect(Object.keys(patch).sort()).toEqual(["status", "updated_at"]);
    expect(mockEq).toHaveBeenCalledWith("id", "l1");
  });

  it("throws when the server refuses, so the queue can retry", async () => {
    mockEq.mockResolvedValue({ error: { message: "nope" } });
    await expect(updateLead("l1", { note: "x" })).rejects.toEqual({ message: "nope" });
  });
});
