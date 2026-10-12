import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import type { TFunction } from "i18next";
import { Platform } from "react-native";
import { supabase } from "@/api/supabase";
import { appVersion } from "@/lib/build";

/**
 * Push on this phone (PLAN.md §4.7): ask only after the in-app explainer,
 * register the phone's Expo token with the account (register_push_device,
 * 0034), keep it fresh each launch, and remove it at sign-out so the next
 * person to use the phone gets nobody else's notifications.
 */
export type PushKind = "lead" | "first_tap" | "term";
export type PushPrefs = Record<PushKind, boolean>;
export type Permission = "granted" | "denied" | "undetermined";

const TOKEN_KEY = "taptap.pushToken";
export const DEFAULT_PREFS: PushPrefs = { lead: true, first_tap: true, term: true };

/**
 * Android channels, one per kind, each mutable in the phone's settings. Leads
 * are high importance: they make a sound and show on top, and high-priority
 * pushes on this channel get through Doze on Tecno/HiOS phones.
 */
export async function ensureChannels(t: TFunction): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("leads", {
    name: t("push.channelLeads"),
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync("cards", {
    name: t("push.channelCards"),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync("account", {
    name: t("push.channelAccount"),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function permission(): Promise<Permission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/** The operating system's prompt. Only ever called from the explainer's "Turn on". */
export async function askPermission(): Promise<Permission> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Registers this phone and returns its switches. Null when it cannot: no
 * permission, no Firebase config in this build (Android), or no network — the
 * next launch tries again.
 */
export async function registerThisPhone(): Promise<PushPrefs | null> {
  if ((await permission()) !== "granted") return null;
  let token: string;
  try {
    ({ data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() }));
  } catch {
    return null;
  }
  const { data, error } = await supabase.rpc("register_push_device", {
    p_token: token,
    p_platform: Platform.OS === "ios" ? "ios" : "android",
    p_app_version: appVersion,
    p_locale: Intl.DateTimeFormat().resolvedOptions().locale,
  });
  if (error) return null;
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => undefined);
  return toPrefs((data as { prefs?: unknown } | null)?.prefs);
}

export async function storedToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
}

/**
 * At sign-out, while the session still works: this phone stops receiving the
 * account's notifications. Best effort, and quick — signing out never waits on
 * it for long.
 */
export async function unregisterThisPhone(timeoutMs = 3000): Promise<void> {
  const token = await storedToken();
  if (!token) return;
  await Promise.race([
    supabase.rpc("unregister_push_device", { p_token: token }).then(() => undefined, () => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
}

export async function setPrefs(change: Partial<PushPrefs>): Promise<PushPrefs> {
  const token = await storedToken();
  if (!token) throw new Error("This phone is not registered for notifications");
  const { data, error } = await supabase.rpc("set_push_prefs", { p_token: token, p_prefs: change });
  if (error) throw error;
  return toPrefs((data as { prefs?: unknown } | null)?.prefs);
}

export function toPrefs(raw: unknown): PushPrefs {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    lead: obj.lead !== false,
    first_tap: obj.first_tap !== false,
    term: obj.term !== false,
  };
}

/** Where a tapped notification opens (PLAN.md §7.4). Unknown kinds open Home. */
export function routeFor(data: unknown): string {
  const d = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const id = typeof d.id === "string" && /^[0-9a-f-]{36}$/i.test(d.id) ? d.id : null;
  switch (d.kind) {
    case "lead":
      return id ? `/lead/${id}` : "/leads";
    case "first_tap":
      return id ? `/card/${id}` : "/cards";
    case "term":
      return "/cards";
    default:
      return "/";
  }
}

/**
 * Tecno, Infinix and itel phones (Transsion's HiOS / XOS) stop apps in the
 * background aggressively; the notifications screen shows how to allow TapTap.
 */
export function needsBackgroundHelp(): boolean {
  if (Platform.OS !== "android") return false;
  const c = Platform.constants as { Brand?: string; Manufacturer?: string };
  return /tecno|infinix|itel|transsion/i.test(`${c.Brand ?? ""} ${c.Manufacturer ?? ""}`);
}
