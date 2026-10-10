import "@/i18n";
import { useIsRestoring } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { QueryProvider } from "@/api/query";
import { SessionProvider, useSession } from "@/auth/session";
import { canEnterApp } from "@/auth/session-state";
import { loadOnboarded, useOnboarded } from "@/features/onboarding/onboarding";
import { initSentry, Sentry } from "@/lib/sentry";
import { useTheme } from "@/theme/use-theme";
import { stackScreenOptions } from "@/ui/navigation";
import { ToastProvider } from "@/ui/toast";

initSentry();

// The splash stays up until the app knows who is signed in, whether to show
// the welcome screens, and what was cached — so the first frame is the right
// screen with data in it, never a flash of sign-in (PLAN.md §4.5).
void SplashScreen.preventAutoHideAsync();
loadOnboarded();

function RootLayout() {
  return (
    <QueryProvider>
      <SessionProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </SessionProvider>
    </QueryProvider>
  );
}

function RootNavigator() {
  const { t } = useTranslation();
  const { scheme, colors } = useTheme();
  const { state } = useSession();
  const onboarded = useOnboarded();
  const restoringCache = useIsRestoring();
  const ready = state.status !== "restoring" && onboarded !== null && !restoringCache;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // The window behind every screen, so a theme change or a transition never
  // flashes the wrong colour.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  if (!ready) return null;

  const inApp = canEnterApp(state);

  // Each group exists only while its guard holds. When a guard flips — signing
  // in, signing out, finishing the welcome — Expo Router moves to the first
  // screen still available, so no screen navigates by hand after auth changes.
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={stackScreenOptions(colors)}>
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!inApp}>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in-code" options={{ title: t("code.title") }} />
          <Stack.Screen name="forgot-password" options={{ title: t("forgot.title") }} />
        </Stack.Protected>

        {/* Development and preview builds only; each screen redirects otherwise. */}
        <Stack.Screen name="dev/foundation" options={{ title: t("dev.foundationTitle") }} />
        <Stack.Screen name="dev/nfc" options={{ title: t("dev.nfcTitle") }} />
      </Stack>
    </>
  );
}

export default Sentry.wrap(RootLayout);
