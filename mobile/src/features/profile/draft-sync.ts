import type { DraftInput } from "@taptap/core/draft";
import { draftInput, type EditorDraft } from "./model";

/**
 * Profile edits, saved automatically and never lost (PLAN.md §4.5, §6).
 *
 * Every edit lands here first and is written to the phone straight away, so it
 * survives the app being closed, the phone restarting, or a day offline. A
 * moment after typing stops, it is sent to the server (PUT …/draft). One save
 * per profile is in flight at a time; edits made meanwhile go in the next one,
 * based on the version the first returned.
 *
 *   offline, timeout, 5xx   kept, retried with back-off and as soon as the
 *                           phone is back online. Repeating a save is harmless:
 *                           every action carries its own id (D-046).
 *   409 conflict            someone saved this profile elsewhere since. Never
 *                           overwritten silently: saving stops until the owner
 *                           picks a version.
 *   422 / 400               the server refused the content. Stops until the
 *                           next edit, which presumably fixes it.
 *   404                     the profile is gone (deleted on the web). Dropped.
 *
 * No React in here, so the rules are tested without rendering anything
 * (draft-sync.test.ts); draft-sync-instance.ts wires it to the real API.
 */

export type SaveOutcome =
  | { kind: "saved"; updatedAt: string }
  | { kind: "conflict"; updatedAt: string }
  | { kind: "invalid"; code: string; index?: number }
  | { kind: "gone" }
  | { kind: "retry" };

export type PendingState =
  /** Waiting for typing to stop, or for its turn. */
  | "waiting"
  | "saving"
  /** The last attempt got no answer, or a temporary error; tried again later. */
  | "retrying"
  | "conflict"
  | "invalid";

export type PendingDraft = {
  pageId: string;
  /** The server version these edits are based on. */
  base: string;
  draft: EditorDraft;
  /** Goes up with every edit, so a save knows whether newer edits came in meanwhile. */
  rev: number;
  state: PendingState;
  /** The other version, when state is "conflict". */
  conflictWith?: string;
  /** What the server refused, when state is "invalid". */
  invalid?: { code: string; index?: number };
};

export type DraftSyncSnapshot = {
  drafts: Readonly<Record<string, PendingDraft>>;
  /** When each profile last saved, for "Saved ✓". */
  savedAt: Readonly<Record<string, number>>;
};

export type FlushResult = "saved" | "conflict" | "invalid" | "offline" | "retrying";

export type DraftStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type DraftSyncDeps = {
  save: (pageId: string, input: DraftInput) => Promise<SaveOutcome>;
  storage: DraftStorage;
  isOnline: () => boolean;
  /** Calls back when the phone comes back online; returns an unsubscribe. */
  onOnline: (listener: () => void) => () => void;
  /** After a save: update cached copies of the profile. */
  onSaved: (pageId: string, draft: EditorDraft, updatedAt: string) => void;
  /** The profile no longer exists. */
  onGone: (pageId: string) => void;
  now?: () => number;
  debounceMs?: number;
  retryDelaysMs?: number[];
};

export const STORAGE_KEY = "taptap.drafts";
const DEBOUNCE_MS = 1200;
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

export function createDraftSync(deps: DraftSyncDeps) {
  const now = deps.now ?? Date.now;
  const debounceMs = deps.debounceMs ?? DEBOUNCE_MS;
  const retryDelays = deps.retryDelaysMs ?? RETRY_DELAYS_MS;

  let snapshot: DraftSyncSnapshot = { drafts: {}, savedAt: {} };
  const listeners = new Set<() => void>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const inFlight = new Map<string, Promise<void>>();
  const attempts = new Map<string, number>();
  let loaded: Promise<void> | null = null;
  let generation = 0;

  function emit(next: DraftSyncSnapshot, persist = true) {
    snapshot = next;
    for (const listener of listeners) listener();
    if (persist) void writeStorage();
  }

  function setDraft(pageId: string, entry: PendingDraft | undefined) {
    const drafts = { ...snapshot.drafts };
    if (entry) drafts[pageId] = entry;
    else delete drafts[pageId];
    emit({ ...snapshot, drafts });
  }

  function patch(pageId: string, changes: Partial<PendingDraft>) {
    const current = snapshot.drafts[pageId];
    if (current) setDraft(pageId, { ...current, ...changes });
  }

  async function writeStorage() {
    const drafts = Object.values(snapshot.drafts);
    try {
      if (drafts.length === 0) await deps.storage.removeItem(STORAGE_KEY);
      else await deps.storage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // The draft stays in memory and saves from there; only a crash before it
      // reaches the server would lose it.
    }
  }

  function clearTimer(pageId: string) {
    const timer = timers.get(pageId);
    if (timer) clearTimeout(timer);
    timers.delete(pageId);
  }

  function schedule(pageId: string, delay: number) {
    clearTimer(pageId);
    timers.set(
      pageId,
      setTimeout(() => {
        timers.delete(pageId);
        void run(pageId);
      }, delay),
    );
  }

  /** One save attempt for a page, or a wait for the one already in flight. */
  function run(pageId: string): Promise<void> {
    const running = inFlight.get(pageId);
    if (running) return running;
    const entry = snapshot.drafts[pageId];
    if (!entry || entry.state === "conflict" || entry.state === "invalid") return Promise.resolve();
    if (!deps.isOnline()) {
      if (entry.state !== "retrying") patch(pageId, { state: "retrying" });
      return Promise.resolve();
    }

    const sent = { rev: entry.rev, draft: entry.draft, base: entry.base };
    const startedIn = generation;
    patch(pageId, { state: "saving" });

    const attempt = (async () => {
      let outcome: SaveOutcome;
      try {
        outcome = await deps.save(pageId, draftInput(sent.draft, sent.base));
      } catch {
        outcome = { kind: "retry" };
      }
      // Signed out (or cleared) while this was in flight: forget it.
      if (startedIn !== generation) return;
      const current = snapshot.drafts[pageId];
      if (!current) return;

      switch (outcome.kind) {
        case "saved": {
          attempts.delete(pageId);
          deps.onSaved(pageId, sent.draft, outcome.updatedAt);
          const savedAt = { ...snapshot.savedAt, [pageId]: now() };
          if (current.rev === sent.rev) {
            const drafts = { ...snapshot.drafts };
            delete drafts[pageId];
            emit({ drafts, savedAt });
          } else {
            // Edits arrived meanwhile: they go next, based on the new version.
            emit({
              drafts: { ...snapshot.drafts, [pageId]: { ...current, base: outcome.updatedAt, state: "waiting" } },
              savedAt,
            });
            schedule(pageId, 0);
          }
          return;
        }
        case "conflict":
          attempts.delete(pageId);
          patch(pageId, { state: "conflict", conflictWith: outcome.updatedAt });
          return;
        case "invalid":
          attempts.delete(pageId);
          // Edited since this was sent? Then the edit may have fixed it: try that.
          if (current.rev !== sent.rev) {
            patch(pageId, { state: "waiting" });
            schedule(pageId, 0);
          } else {
            patch(pageId, { state: "invalid", invalid: { code: outcome.code, index: outcome.index } });
          }
          return;
        case "gone":
          attempts.delete(pageId);
          setDraft(pageId, undefined);
          deps.onGone(pageId);
          return;
        case "retry": {
          const n = attempts.get(pageId) ?? 0;
          attempts.set(pageId, n + 1);
          patch(pageId, { state: "retrying" });
          schedule(pageId, retryDelays[Math.min(n, retryDelays.length - 1)]);
          return;
        }
      }
    })().finally(() => inFlight.delete(pageId));

    inFlight.set(pageId, attempt);
    return attempt;
  }

  const unsubscribeOnline = deps.onOnline(() => {
    for (const entry of Object.values(snapshot.drafts)) {
      if (entry.state === "retrying" || entry.state === "waiting") {
        attempts.delete(entry.pageId);
        schedule(entry.pageId, 0);
      }
    }
  });

  return {
    /** Reads drafts left on the phone by an earlier run and starts sending them. */
    load(): Promise<void> {
      loaded ??= (async () => {
        let stored: PendingDraft[] = [];
        try {
          const raw = await deps.storage.getItem(STORAGE_KEY);
          const parsed: unknown = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) stored = parsed as PendingDraft[];
        } catch {
          stored = [];
        }
        const drafts: Record<string, PendingDraft> = { ...snapshot.drafts };
        for (const entry of stored) {
          if (!entry?.pageId || drafts[entry.pageId]) continue;
          // A save that was in flight when the app stopped never got its answer.
          const state = entry.state === "saving" ? "waiting" : entry.state;
          drafts[entry.pageId] = { ...entry, state };
        }
        emit({ ...snapshot, drafts }, false);
        for (const entry of Object.values(drafts)) {
          if (entry.state === "waiting" || entry.state === "retrying") schedule(entry.pageId, 0);
        }
      })();
      return loaded;
    },

    /**
     * Applies an edit. `base` and `current` are the profile's server version and
     * content, used only when there are no unsaved edits yet; otherwise the edit
     * applies on top of those.
     */
    update(pageId: string, base: string, current: EditorDraft, change: (d: EditorDraft) => EditorDraft) {
      const existing = snapshot.drafts[pageId];
      const draft = change(existing?.draft ?? current);
      const state: PendingState =
        existing?.state === "conflict" ? "conflict" : existing?.state === "saving" ? "saving" : "waiting";
      setDraft(pageId, {
        pageId,
        base: existing?.base ?? base,
        draft,
        rev: (existing?.rev ?? 0) + 1,
        state,
        conflictWith: existing?.conflictWith,
      });
      if (state !== "conflict") schedule(pageId, debounceMs);
    },

    /**
     * Saves now and waits for the answer — before Publish, which snapshots what
     * the server has. Resolves "saved" when nothing is left unsent.
     */
    async flush(pageId: string): Promise<FlushResult> {
      for (let i = 0; i < 3; i++) {
        const entry = snapshot.drafts[pageId];
        if (!entry) return "saved";
        if (entry.state === "conflict") return "conflict";
        if (entry.state === "invalid") return "invalid";
        if (!deps.isOnline()) return "offline";
        clearTimer(pageId);
        await run(pageId);
      }
      const entry = snapshot.drafts[pageId];
      if (!entry) return "saved";
      return entry.state === "conflict" || entry.state === "invalid" ? entry.state : "retrying";
    },

    /** After a conflict: replace the other version with this one, or drop this one. */
    resolveConflict(pageId: string, choice: "keepMine" | "useTheirs") {
      const entry = snapshot.drafts[pageId];
      if (!entry || entry.state !== "conflict") return;
      if (choice === "useTheirs") {
        clearTimer(pageId);
        setDraft(pageId, undefined);
        return;
      }
      setDraft(pageId, {
        ...entry,
        base: entry.conflictWith ?? entry.base,
        state: "waiting",
        conflictWith: undefined,
      });
      schedule(pageId, 0);
    },

    /** Throws away unsaved edits to one profile. */
    discard(pageId: string) {
      clearTimer(pageId);
      setDraft(pageId, undefined);
    },

    /** Forgets everything, on this phone too — on sign-out. */
    async clear(): Promise<void> {
      generation++;
      for (const pageId of timers.keys()) clearTimer(pageId);
      attempts.clear();
      emit({ drafts: {}, savedAt: {} }, false);
      try {
        await deps.storage.removeItem(STORAGE_KEY);
      } catch {
        // Gone from memory regardless. Should a stale copy be read at a later
        // launch by someone else, its saves are refused by RLS (404) and dropped.
      }
    },

    get(pageId: string): PendingDraft | undefined {
      return snapshot.drafts[pageId];
    },

    getSnapshot(): DraftSyncSnapshot {
      return snapshot;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Test helper: stop listening to the network. */
    dispose() {
      unsubscribeOnline();
      for (const pageId of timers.keys()) clearTimer(pageId);
    },
  };
}

export type DraftSync = ReturnType<typeof createDraftSync>;
