import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as Network from "expo-network";
import type { PropsWithChildren } from "react";
import { AppState } from "react-native";
import { appVersion } from "@/lib/build";
import { registerLeadEdits } from "./lead-edits";

/**
 * The data cache (PLAN.md §4.5): every screen paints what this phone already
 * knows, then refreshes behind it. Persisted, so a launch with no network still
 * shows the last known state rather than a blank screen.
 */
const DAY = 24 * 60 * 60 * 1000;
export const CACHE_MAX_AGE = 7 * DAY;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Must be at least the persisted age, or entries are dropped from
      // memory before they can be restored.
      gcTime: CACHE_MAX_AGE,
      staleTime: 30_000,
      retry: 2,
    },
  },
});

// How queued edits are sent must be known before the cache is restored, so a
// change paused in an earlier run can be resumed (src/api/lead-edits.ts).
registerLeadEdits(queryClient);

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "taptap.cache",
  // Writes are batched: a burst of updates costs one disk write.
  throttleTime: 1000,
});

function isOnline(state: Network.NetworkState): boolean {
  // Unknown counts as online: wrongly showing "offline" is worse than one
  // request failing and showing its own error.
  return state.isConnected !== false && state.isInternetReachable !== false;
}

onlineManager.setEventListener((setOnline) => {
  void Network.getNetworkStateAsync().then(
    (state) => setOnline(isOnline(state)),
    () => undefined,
  );
  const subscription = Network.addNetworkStateListener((state) => setOnline(isOnline(state)));
  return () => subscription.remove();
});

// Refetch stale data when the app comes back to the front, as a browser does on
// tab focus.
AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));

export function QueryProvider({ children }: PropsWithChildren) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        // A new app version starts from an empty cache, so an old shape of
        // data never reaches new code.
        buster: appVersion,
      }}
      // Edits made offline in an earlier run go out once the cache is back.
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

/** Forget every cached answer, in memory and on disk — on sign-out. */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}
