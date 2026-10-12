import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { ensureChannels, permission, registerThisPhone, routeFor, type Permission } from "./push";

// While the app is open, a notification still shows — a lead is worth an
// interruption — and the lists behind it refresh.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const pushPrefsKey = ["pushPrefs"] as const;
export const pushPermissionKey = ["pushPermission"] as const;

/** The phone's notification permission, re-read whenever the app comes back to the front. */
export function usePushPermission() {
  const queryClient = useQueryClient();
  const query = useQuery<Permission>({ queryKey: pushPermissionKey, queryFn: permission, staleTime: 0, gcTime: 0 });
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void queryClient.invalidateQueries({ queryKey: pushPermissionKey });
    });
    return () => sub.remove();
  }, [queryClient]);
  return query;
}

/**
 * Signed in: make the channels, refresh this phone's registration (tokens can
 * change), and open the right screen when a notification is tapped — also the
 * one that launched the app.
 */
export function usePushSetup() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    void ensureChannels(t);
    void registerThisPhone().then((prefs) => {
      if (prefs) queryClient.setQueryData(pushPrefsKey, prefs);
    });
    const tokenSub = Notifications.addPushTokenListener(() => {
      void registerThisPhone().then((prefs) => prefs && queryClient.setQueryData(pushPrefsKey, prefs));
    });
    const receivedSub = Notifications.addNotificationReceivedListener((n) => {
      const kind = (n.request.content.data as { kind?: string } | undefined)?.kind;
      if (kind === "lead") {
        void queryClient.invalidateQueries({ queryKey: ["leads"] });
        void queryClient.invalidateQueries({ queryKey: ["leadCounts"] });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["cards"] });
      }
    });
    return () => {
      tokenSub.remove();
      receivedSub.remove();
    };
  }, [t, queryClient]);

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const route = routeFor(lastResponse.notification.request.content.data);
    // The lead or card may be newer than the cache.
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["cards"] });
    router.push(route as never);
    // Handled once; a re-render must not open it again.
    Notifications.clearLastNotificationResponse();
  }, [lastResponse, queryClient]);
}

/** Whether the Home explainer was dismissed ("Not now"), remembered on this phone. */
const DISMISSED_KEY = "taptap.pushExplainerDismissed";
let dismissed: boolean | null = null;
const listeners = new Set<() => void>();
function setDismissed(value: boolean) {
  dismissed = value;
  for (const l of listeners) l();
}
export function loadExplainerDismissed() {
  AsyncStorage.getItem(DISMISSED_KEY).then(
    (v) => setDismissed(v === "1"),
    () => setDismissed(false),
  );
}
export function useExplainerDismissed(): boolean | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dismissed,
  );
}
export function dismissExplainer() {
  setDismissed(true);
  void AsyncStorage.setItem(DISMISSED_KEY, "1").catch(() => undefined);
}
