import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * Whether the phone can reach the internet — the same signal that pauses and
 * resumes data requests (src/api/query.tsx), so a banner and the data never
 * disagree.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  );
}
