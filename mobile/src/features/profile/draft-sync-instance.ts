import AsyncStorage from "@react-native-async-storage/async-storage";
import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { callAppApi, NetworkError, NotSignedInError } from "@/api/app-api";
import type { Profile } from "@/api/pages";
import { queryClient } from "@/api/query";
import { Sentry } from "@/lib/sentry";
import { createDraftSync, type PendingDraft, type SaveOutcome } from "./draft-sync";
import { withSavedDraft, type EditorDraft } from "./model";

/** PUT /api/app/v1/pages/{id}/draft, its answers turned into what the sync needs. */
export async function saveOverApi(pageId: string, input: unknown): Promise<SaveOutcome> {
  try {
    const { status, body } = await callAppApi("PUT", `/api/app/v1/pages/${pageId}/draft`, input);
    const updatedAt = typeof body.updatedAt === "string" ? body.updatedAt : null;
    // Only the route's own JSON answers are trusted to mean something final. A
    // bare 404 is the website without this route (an older deploy, a proxy):
    // reading it as "profile deleted" would throw the owner's edits away.
    const code = typeof body.code === "string" ? body.code : null;
    if (status === 200 && updatedAt) return { kind: "saved", updatedAt };
    if (status === 409 && updatedAt) return { kind: "conflict", updatedAt };
    if (status === 404 && code === "not_found") return { kind: "gone" };
    if ((status === 422 || status === 400) && code) {
      // 400 means this app sent something malformed — a bug worth knowing about.
      // The field name says where; no content is sent.
      if (status === 400) {
        Sentry.captureMessage("Draft save refused as malformed", {
          extra: { field: typeof body.field === "string" ? body.field : null },
        });
      }
      return { kind: "invalid", code, index: typeof body.index === "number" ? body.index : undefined };
    }
    // 401 (a token about to be refreshed), 5xx, 503 while the database catches up.
    return { kind: "retry" };
  } catch (error) {
    if (error instanceof NetworkError || error instanceof NotSignedInError) return { kind: "retry" };
    throw error;
  }
}

function updateCachedProfile(pageId: string, change: (p: Profile) => Profile) {
  queryClient.setQueriesData<Profile[]>({ queryKey: ["pages"] }, (pages) =>
    pages?.map((p) => (p.id === pageId ? change(p) : p)),
  );
}

export const draftSync = createDraftSync({
  save: saveOverApi,
  storage: AsyncStorage,
  isOnline: () => onlineManager.isOnline(),
  onOnline: (listener) =>
    onlineManager.subscribe((online) => {
      if (online) listener();
    }),
  onSaved: (pageId: string, draft: EditorDraft, updatedAt: string) =>
    updateCachedProfile(pageId, (p) => withSavedDraft(p, draft, updatedAt)),
  onGone: () => void queryClient.invalidateQueries({ queryKey: ["pages"] }),
});

/** This profile's unsaved edits, if any; re-renders as they change. */
export function usePendingDraft(pageId: string | undefined): PendingDraft | undefined {
  return useSyncExternalStore(draftSync.subscribe, () =>
    pageId ? draftSync.getSnapshot().drafts[pageId] : undefined,
  );
}

/** When this profile last saved, for "Saved ✓". */
export function useSavedAt(pageId: string | undefined): number | undefined {
  return useSyncExternalStore(draftSync.subscribe, () =>
    pageId ? draftSync.getSnapshot().savedAt[pageId] : undefined,
  );
}
