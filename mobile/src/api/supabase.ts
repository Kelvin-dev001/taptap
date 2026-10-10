import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { createEncryptedStorage } from "@/auth/encrypted-storage";
import { env } from "@/config/env";

/** Where supabase-js keeps the session — fixed, so the app can read it too. */
export const SESSION_KEY = "taptap.session";

const secureOptions: SecureStore.SecureStoreOptions = {
  // Readable once the phone has been unlocked after a restart, so a refresh
  // from a background task works while it is locked. THIS_DEVICE_ONLY keeps the
  // key out of iCloud Keychain and device-to-device transfers: a new phone signs
  // in again rather than inheriting a session.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const sessionStorage = createEncryptedStorage({
  keys: {
    getItemAsync: (key) => SecureStore.getItemAsync(key, secureOptions),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, secureOptions),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, secureOptions),
  },
  values: AsyncStorage,
  randomBytes: getRandomBytes,
});

/**
 * Whether a session was stored when the app started, read before the client
 * below exists. The client may reject that session (a revoked refresh token)
 * and delete it; knowing it was there is how sign-in can say "you were signed
 * out" instead of greeting the person as if they had never signed in.
 */
export const hadSessionAtLaunch: Promise<boolean> = sessionStorage
  .getItem(SESSION_KEY)
  .then(Boolean, () => false);

/**
 * The one Supabase client. It carries the publishable key and the person's own
 * session, so every read and write runs under their RLS policies (PLAN.md §4.1).
 * Without settings (a build missing its environment) it points nowhere, and
 * sign-in explains rather than the app crashing at start-up.
 */
export const supabase = createClient(
  env.supabaseUrl || "https://not-configured.invalid",
  env.supabaseKey || "not-configured",
  {
    auth: {
      storage: sessionStorage,
      storageKey: SESSION_KEY,
      autoRefreshToken: true,
      persistSession: true,
      // No URL to read a session from: emailed links are handled by the website,
      // and links into the app (M6) are verified explicitly.
      detectSessionInUrl: false,
    },
  },
);

// Refresh the token only while the app is in front (Supabase's React Native
// pattern). A backgrounded app has no timers it can rely on, and refreshing
// on return covers the gap. supabase-js only starts this by itself in a
// browser, so the first start is ours too.
if (AppState.currentState === "active") void supabase.auth.startAutoRefresh();
AppState.addEventListener("change", (state) => {
  if (state === "active") void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
