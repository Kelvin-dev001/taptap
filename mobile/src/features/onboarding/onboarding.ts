import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

/**
 * Whether this install has shown the welcome screens (PLAN.md §6: up to three,
 * shown once, skippable). Per install, not per person: signing out and back in
 * does not show them again.
 */
const KEY = "taptap.onboarded";

let onboarded: boolean | null = null;
const listeners = new Set<() => void>();

function set(value: boolean) {
  onboarded = value;
  for (const listener of listeners) listener();
}

/** Starts reading the flag; call once at launch. Null until it is known. */
export function loadOnboarded(): void {
  AsyncStorage.getItem(KEY).then(
    (value) => set(value === "1"),
    // If storage cannot be read, skip the welcome rather than block start-up.
    () => set(true),
  );
}

export function useOnboarded(): boolean | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => onboarded,
  );
}

export function completeOnboarding(): void {
  set(true);
  void AsyncStorage.setItem(KEY, "1").catch(() => undefined);
}
