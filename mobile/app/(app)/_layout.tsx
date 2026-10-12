import { Stack } from "expo-router";
import { useEffect } from "react";
import { draftSync } from "@/features/profile/draft-sync-instance";
import { loadSelectedProfile } from "@/features/profile/selection";
import { loadExplainerDismissed, usePushSetup } from "@/features/push/use-push";
import { useTheme } from "@/theme/use-theme";
import { stackScreenOptions } from "@/ui/navigation";

/**
 * Everything behind sign-in. The tabs sit at the bottom of this stack; detail
 * screens (the editor, an action, the QR code) push on top of them, so the tab
 * bar hides while one is open.
 */
export default function SignedInLayout() {
  const { colors } = useTheme();
  usePushSetup();

  // Profile edits left unsent by an earlier run (offline, or the app closed
  // mid-save) start sending as soon as someone is signed in.
  useEffect(() => {
    void draftSync.load();
    loadSelectedProfile();
    loadExplainerDismissed();
  }, []);

  return (
    <Stack screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profile/[id]/edit" />
      <Stack.Screen name="profile/[id]/action" options={{ presentation: "modal" }} />
      <Stack.Screen name="profile/[id]/preview" options={{ presentation: "modal" }} />
      <Stack.Screen name="qr/[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="lead/[id]" />
      <Stack.Screen name="card/[id]" />
      <Stack.Screen name="card/set-up" options={{ presentation: "modal" }} />
      <Stack.Screen name="settings/delete-account" />
      <Stack.Screen name="settings/notifications" />
    </Stack>
  );
}
