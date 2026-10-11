import type { DraftInput } from "@taptap/core/draft";
import { createDraftSync, STORAGE_KEY, type DraftSyncDeps, type SaveOutcome } from "./draft-sync";
import type { EditorDraft } from "./model";

jest.mock("@/config/env", () => ({ env: { siteUrl: "https://taptap.example" } }));

const ACTION = "3f6c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f";
const draft = (title: string): EditorDraft => ({
  title,
  redirectUrl: "",
  config: {},
  theme: {},
  blocks: [{ id: ACTION, type: "call", label: "Call", value: "0722000000", isActive: true }],
});
const rename = (title: string) => (d: EditorDraft) => ({ ...d, title });

/** A server whose answers the test hands out one at a time. */
function harness(overrides: Partial<DraftSyncDeps> = {}) {
  const sent: { pageId: string; input: DraftInput }[] = [];
  const pending: ((o: SaveOutcome) => void)[] = [];
  const store = new Map<string, string>();
  let online = true;
  const onlineListeners = new Set<() => void>();
  const saved: { pageId: string; title: string; updatedAt: string }[] = [];
  const gone: string[] = [];

  const deps: DraftSyncDeps = {
    save: (pageId, input) => {
      sent.push({ pageId, input });
      return new Promise((resolve) => pending.push(resolve));
    },
    storage: {
      getItem: async (k) => store.get(k) ?? null,
      setItem: async (k, v) => void store.set(k, v),
      removeItem: async (k) => void store.delete(k),
    },
    isOnline: () => online,
    onOnline: (l) => {
      onlineListeners.add(l);
      return () => onlineListeners.delete(l);
    },
    onSaved: (pageId, d, updatedAt) => saved.push({ pageId, title: d.title, updatedAt }),
    onGone: (pageId) => gone.push(pageId),
    now: () => 1000,
    debounceMs: 1000,
    retryDelaysMs: [2000, 5000],
    ...overrides,
  };
  const sync = createDraftSync(deps);

  return {
    sync,
    sent,
    store,
    saved,
    gone,
    /** Answers the oldest unanswered save. */
    async answer(outcome: SaveOutcome) {
      const resolve = pending.shift();
      if (!resolve) throw new Error("no save in flight");
      resolve(outcome);
      await flushPromises();
    },
    goOffline() {
      online = false;
    },
    async goOnline() {
      online = true;
      for (const l of onlineListeners) l();
      await flushPromises();
    },
  };
}

async function flushPromises() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

async function advance(ms: number) {
  jest.advanceTimersByTime(ms);
  await flushPromises();
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("draft sync", () => {
  it("waits for typing to stop, then sends one save with the version it is based on", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Ma"));
    await advance(500);
    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    await advance(999);
    expect(h.sent).toHaveLength(0);
    await advance(1);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].input).toMatchObject({ expectedUpdatedAt: "v1", title: "Mama" });
    expect(h.sync.get("p1")?.state).toBe("saving");

    await h.answer({ kind: "saved", updatedAt: "v2" });
    expect(h.sync.get("p1")).toBeUndefined();
    expect(h.saved).toEqual([{ pageId: "p1", title: "Mama", updatedAt: "v2" }]);
    expect(h.sync.getSnapshot().savedAt.p1).toBe(1000);
  });

  it("keeps every edit on the phone until the server has it", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    await flushPromises();
    const stored = JSON.parse(h.store.get(STORAGE_KEY)!);
    expect(stored).toEqual([expect.objectContaining({ pageId: "p1", base: "v1", draft: draft("Mama") })]);

    await advance(1000);
    await h.answer({ kind: "saved", updatedAt: "v2" });
    expect(h.store.has(STORAGE_KEY)).toBe(false);
  });

  it("sends edits made during a save next, based on the version that save returned", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    await advance(1000);
    h.sync.update("p1", "v1", draft("M"), rename("Mama Mboga"));
    await advance(1000);
    expect(h.sent).toHaveLength(1); // still one in flight

    await h.answer({ kind: "saved", updatedAt: "v2" });
    await advance(0);
    expect(h.sent).toHaveLength(2);
    expect(h.sent[1].input).toMatchObject({ expectedUpdatedAt: "v2", title: "Mama Mboga" });
    await h.answer({ kind: "saved", updatedAt: "v3" });
    expect(h.sync.get("p1")).toBeUndefined();
    expect(h.saved.map((s) => s.updatedAt)).toEqual(["v2", "v3"]);
  });

  it("builds edits on top of unsaved ones, ignoring the screen's older copy", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("Old"), rename("New"));
    h.sync.update("p1", "v1", draft("Old"), (d) => ({ ...d, theme: { accent: "#111" } }));
    expect(h.sync.get("p1")?.draft).toMatchObject({ title: "New", theme: { accent: "#111" } });
    expect(h.sync.get("p1")?.rev).toBe(2);
  });

  it("holds edits while offline and sends them when the phone is back", async () => {
    const h = harness();
    h.goOffline();
    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    await advance(5000);
    expect(h.sent).toHaveLength(0);
    expect(h.sync.get("p1")?.state).toBe("retrying");

    await h.goOnline();
    await advance(0);
    expect(h.sent).toHaveLength(1);
    await h.answer({ kind: "saved", updatedAt: "v2" });
    expect(h.sync.get("p1")).toBeUndefined();
  });

  it("retries a save that got no answer, backing off, with the same content", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    await advance(1000);
    await h.answer({ kind: "retry" });
    expect(h.sync.get("p1")?.state).toBe("retrying");
    await advance(1999);
    expect(h.sent).toHaveLength(1);
    await advance(1);
    expect(h.sent).toHaveLength(2);
    await h.answer({ kind: "retry" });
    await advance(4999);
    expect(h.sent).toHaveLength(2);
    await advance(1);
    expect(h.sent).toHaveLength(3);
    expect(h.sent[2].input).toEqual(h.sent[0].input);
  });

  it("treats a save that throws as one to retry", async () => {
    const h = harness({ save: () => Promise.reject(new Error("socket hang up")) });
    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    await advance(1000);
    expect(h.sync.get("p1")?.state).toBe("retrying");
  });

  it("stops at a conflict and never overwrites the other version on its own", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Mine"));
    await advance(1000);
    await h.answer({ kind: "conflict", updatedAt: "v9" });
    expect(h.sync.get("p1")).toMatchObject({ state: "conflict", conflictWith: "v9" });

    // Further typing is kept, but nothing is sent.
    h.sync.update("p1", "v1", draft("M"), rename("Mine, still"));
    await advance(10_000);
    await h.goOnline();
    expect(h.sent).toHaveLength(1);
    expect(await h.sync.flush("p1")).toBe("conflict");
  });

  it("keeps mine on request: resends on top of the other version", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Mine"));
    await advance(1000);
    await h.answer({ kind: "conflict", updatedAt: "v9" });

    h.sync.resolveConflict("p1", "keepMine");
    await advance(0);
    expect(h.sent[1].input).toMatchObject({ expectedUpdatedAt: "v9", title: "Mine" });
    await h.answer({ kind: "saved", updatedAt: "v10" });
    expect(h.sync.get("p1")).toBeUndefined();
  });

  it("uses theirs on request: drops mine without sending", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Mine"));
    await advance(1000);
    await h.answer({ kind: "conflict", updatedAt: "v9" });
    h.sync.resolveConflict("p1", "useTheirs");
    await advance(5000);
    expect(h.sync.get("p1")).toBeUndefined();
    expect(h.sent).toHaveLength(1);
  });

  it("stops on content the server refuses, and tries again after the next edit", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    await advance(1000);
    await h.answer({ kind: "invalid", code: "invalid_destination", index: 0 });
    expect(h.sync.get("p1")).toMatchObject({ state: "invalid", invalid: { code: "invalid_destination", index: 0 } });
    await advance(60_000);
    expect(h.sent).toHaveLength(1);

    h.sync.update("p1", "v1", draft("M"), rename("Mama Mboga"));
    await advance(1000);
    expect(h.sent).toHaveLength(2);
    expect(h.sent[1].input.expectedUpdatedAt).toBe("v1");
  });

  it("drops edits to a profile that no longer exists", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    await advance(1000);
    await h.answer({ kind: "gone" });
    expect(h.sync.get("p1")).toBeUndefined();
    expect(h.gone).toEqual(["p1"]);
  });

  it("saves now and waits, for Publish", async () => {
    const h = harness();
    expect(await h.sync.flush("p1")).toBe("saved"); // nothing to send

    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    const result = h.sync.flush("p1");
    await flushPromises();
    expect(h.sent).toHaveLength(1); // no debounce wait
    await h.answer({ kind: "saved", updatedAt: "v2" });
    await expect(result).resolves.toBe("saved");

    h.goOffline();
    h.sync.update("p1", "v2", draft("M"), rename("Offline edit"));
    await expect(h.sync.flush("p1")).resolves.toBe("offline");
  });

  it("picks up drafts an earlier run left on the phone and sends them", async () => {
    const first = harness();
    first.sync.update("p1", "v1", draft("M"), rename("Typed before the app closed"));
    await flushPromises();
    const left = first.store.get(STORAGE_KEY)!;
    first.sync.dispose();

    const second = harness();
    second.store.set(STORAGE_KEY, left.replace('"waiting"', '"saving"'));
    await second.sync.load();
    expect(second.sync.get("p1")?.state).toBe("waiting");
    await advance(0);
    expect(second.sent[0].input).toMatchObject({
      expectedUpdatedAt: "v1",
      title: "Typed before the app closed",
    });
  });

  it("survives unreadable storage", async () => {
    const h = harness();
    h.store.set(STORAGE_KEY, "{not json");
    await h.sync.load();
    expect(h.sync.getSnapshot().drafts).toEqual({});
  });

  it("forgets everything on sign-out, including a save still in flight", async () => {
    const h = harness();
    h.sync.update("p1", "v1", draft("M"), rename("Mama"));
    h.sync.update("p2", "v1", draft("M"), rename("Other"));
    await advance(1000);
    await h.sync.clear();
    expect(h.sync.getSnapshot()).toEqual({ drafts: {}, savedAt: {} });
    expect(h.store.has(STORAGE_KEY)).toBe(false);

    await h.answer({ kind: "saved", updatedAt: "v2" });
    expect(h.saved).toEqual([]); // the answer for the old session is ignored
  });

  it("saves different profiles independently", async () => {
    const h = harness();
    h.sync.update("p1", "a1", draft("M"), rename("One"));
    h.sync.update("p2", "b1", draft("M"), rename("Two"));
    await advance(1000);
    expect(h.sent.map((s) => s.pageId)).toEqual(["p1", "p2"]);
  });
});
