import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

/**
 * Which profile Home shows, for accounts with more than one — remembered on
 * this phone, like the onboarding flag. Unknown or deleted ids fall back to
 * pickProfile()'s choice.
 */
const KEY = "taptap.profile";

let selected: string | null = null;
const listeners = new Set<() => void>();

function set(value: string | null) {
  selected = value;
  for (const listener of listeners) listener();
}

/** Starts reading the remembered choice; call once at launch. */
export function loadSelectedProfile(): void {
  AsyncStorage.getItem(KEY).then(
    (value) => {
      // A choice made before the read finished wins.
      if (selected === null) set(value);
    },
    () => undefined,
  );
}

export function useSelectedProfileId(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selected,
  );
}

export function selectProfile(id: string): void {
  set(id);
  void AsyncStorage.setItem(KEY, id).catch(() => undefined);
}

/** On sign-out: the next person's profiles are not this one's. */
export function forgetSelectedProfile(): void {
  set(null);
  void AsyncStorage.removeItem(KEY).catch(() => undefined);
}
