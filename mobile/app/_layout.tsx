import "@/i18n";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { initSentry, Sentry } from "@/lib/sentry";
import { fontFamily } from "@/theme/typography";
import { useTheme } from "@/theme/use-theme";

initSentry();

// Keep the splash up until the first frame is ready. Fonts are embedded at
// build time, so nothing is awaited yet; M1 adds the session and cache restore.
void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const { scheme, colors } = useTheme();

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  // The window behind every screen, so a theme change or a transition never
  // flashes the wrong colour.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: fontFamily("semibold") },
          headerShadowVisible: false,
        }}
      />
    </>
  );
}

export default Sentry.wrap(RootLayout);
