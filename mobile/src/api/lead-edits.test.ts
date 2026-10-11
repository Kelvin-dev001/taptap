import {
  dehydrate,
  hydrate,
  MutationObserver,
  onlineManager,
  QueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type { Lead, LeadCounts } from "@taptap/core/leads";
import {
  applyLeadEdit,
  leadKey,
  moveCount,
  patchLeadPages,
  registerLeadEdits,
  removeCount,
  removeLeadFromCaches,
  UPDATE_LEAD,
  type LeadEdit,
} from "./lead-edits";

const mockUpdateLead = jest.fn();
jest.mock("./leads", () => ({ updateLead: (...a: unknown[]) => mockUpdateLead(...a) }));

const lead = (id: string, overrides: Partial<Lead> = {}): Lead => ({
  id,
  smart_page_id: "p1",
  page_title: null,
  page_slug: "p",
  name: id,
  phone: null,
  email: null,
  company: null,
  message: null,
  status: "new",
  note: null,
  created_at: "2026-10-11T09:00:00Z",
  updated_at: null,
  repeat_count: 0,
  ...overrides,
});

function client() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  registerLeadEdits(c);
  c.setQueryData<InfiniteData<Lead[]>>(["leads", "u", "all", "all"], {
    pages: [[lead("a"), lead("b")], [lead("c")]],
    pageParams: [null, null],
  });
  c.setQueryData<InfiniteData<Lead[]>>(["leads", "u", "new", "all"], { pages: [[lead("a"), lead("b"), lead("c")]], pageParams: [null] });
  c.setQueryData<LeadCounts>(["leadCounts", "u", "all"], { all: 3, by_status: { new: 3 } });
  return c;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => onlineManager.setOnline(true));
beforeEach(() => mockUpdateLead.mockReset());

describe("pure helpers", () => {
  it("patches one lead in every page", () => {
    const data = { pages: [[lead("a")], [lead("b")]], pageParams: [null, null] };
    expect(patchLeadPages(data, "b", { status: "won" })?.pages[1][0].status).toBe("won");
    expect(patchLeadPages(data, "b", { status: "won" })?.pages[0][0]).toBe(data.pages[0][0]);
  });

  it("moves a count between statuses, and removes one", () => {
    const counts: LeadCounts = { all: 3, by_status: { new: 3 } };
    expect(moveCount(counts, "new", "won")).toEqual({ all: 3, by_status: { new: 2, won: 1 } });
    expect(moveCount(counts, "new", "new")).toBe(counts);
    expect(removeCount(counts, "new")).toEqual({ all: 2, by_status: { new: 2 } });
    expect(removeCount({ all: 0, by_status: {} }, "won")).toEqual({ all: 0, by_status: { won: 0 } });
  });
});

describe("applyLeadEdit", () => {
  it("shows a status change in every list, the lead's own screen and the counts", () => {
    const c = client();
    c.setQueryData(leadKey("b"), lead("b"));
    applyLeadEdit(c, { id: "b", patch: { status: "won" } });
    const all = c.getQueryData<InfiniteData<Lead[]>>(["leads", "u", "all", "all"])!;
    expect(all.pages[0][1].status).toBe("won");
    expect(c.getQueryData<Lead>(leadKey("b"))?.status).toBe("won");
    expect(c.getQueryData<LeadCounts>(["leadCounts", "u", "all"])).toEqual({ all: 3, by_status: { new: 2, won: 1 } });
  });

  it("leaves the counts alone for a note", () => {
    const c = client();
    applyLeadEdit(c, { id: "b", patch: { note: "Called back" } });
    expect(c.getQueryData<LeadCounts>(["leadCounts", "u", "all"])).toEqual({ all: 3, by_status: { new: 3 } });
  });

  it("removes a deleted lead everywhere", () => {
    const c = client();
    c.setQueryData(leadKey("c"), lead("c"));
    removeLeadFromCaches(c, lead("c"));
    expect(c.getQueryData<InfiniteData<Lead[]>>(["leads", "u", "all", "all"])!.pages[1]).toEqual([]);
    expect(c.getQueryData(leadKey("c"))).toBeUndefined();
    expect(c.getQueryData<LeadCounts>(["leadCounts", "u", "all"])?.all).toBe(2);
  });
});

describe("the queue", () => {
  function run(c: QueryClient, edit: LeadEdit) {
    const observer = new MutationObserver<void, Error, LeadEdit>(c, {
      mutationKey: UPDATE_LEAD,
      scope: { id: `lead:${edit.id}` },
    });
    return observer.mutate(edit).catch(() => undefined);
  }

  it("sends a change through the registered function, showing it at once", async () => {
    mockUpdateLead.mockResolvedValue(undefined);
    const c = client();
    void run(c, { id: "a", patch: { status: "contacted" } });
    expect(c.getQueryData<InfiniteData<Lead[]>>(["leads", "u", "all", "all"])!.pages[0][0].status).toBe("contacted");
    await flush();
    expect(mockUpdateLead).toHaveBeenCalledWith("a", { status: "contacted" });
  });

  it("holds a change made offline and sends it when the phone is back", async () => {
    mockUpdateLead.mockResolvedValue(undefined);
    const c = client();
    c.mount();
    onlineManager.setOnline(false);
    void run(c, { id: "a", patch: { status: "won" } });
    await flush();
    expect(mockUpdateLead).not.toHaveBeenCalled();
    expect(c.getMutationCache().getAll()[0].state.isPaused).toBe(true);
    // Shown straight away even though it has not gone yet.
    expect(c.getQueryData<LeadCounts>(["leadCounts", "u", "all"])?.by_status.won).toBe(1);

    onlineManager.setOnline(true);
    await flush();
    await flush();
    expect(mockUpdateLead).toHaveBeenCalledWith("a", { status: "won" });
    c.unmount();
  });

  it("survives the app closing: a paused change, saved and restored, is sent by the next run", async () => {
    mockUpdateLead.mockResolvedValue(undefined);
    const first = client();
    onlineManager.setOnline(false);
    void run(first, { id: "b", patch: { note: "Wants a quote" } });
    await flush();
    // What the persister writes to the phone.
    const saved = JSON.parse(JSON.stringify(dehydrate(first)));
    expect(saved.mutations).toHaveLength(1);

    // A new launch: a fresh client knows how to send it only from registerLeadEdits.
    const next = new QueryClient();
    registerLeadEdits(next);
    hydrate(next, saved);
    onlineManager.setOnline(true);
    await next.resumePausedMutations();
    expect(mockUpdateLead).toHaveBeenCalledWith("b", { note: "Wants a quote" });
  });

  it("sends one lead's changes in the order they were made", async () => {
    const order: string[] = [];
    mockUpdateLead.mockImplementation(async (_id: string, patch: { status: string }) => {
      await new Promise((r) => setTimeout(r, patch.status === "contacted" ? 20 : 0));
      order.push(patch.status);
    });
    const c = client();
    const one = run(c, { id: "a", patch: { status: "contacted" } });
    const two = run(c, { id: "a", patch: { status: "won" } });
    await Promise.all([one, two]);
    expect(order).toEqual(["contacted", "won"]);
  });

  it("re-reads the server's version when a change is refused for good", async () => {
    mockUpdateLead.mockRejectedValue(new Error("refused"));
    const c = client();
    c.setMutationDefaults(UPDATE_LEAD, { ...c.getMutationDefaults(UPDATE_LEAD), retry: false });
    const invalidate = jest.spyOn(c, "invalidateQueries");
    await run(c, { id: "a", patch: { status: "lost" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leads"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leadCounts"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: leadKey("a") });
  });
});
