import { Stack } from "expo-router";
import { useTheme } from "@/theme/use-theme";
import { stackScreenOptions } from "@/ui/navigation";

/**
 * Everything behind sign-in. The tabs sit at the bottom of this stack; detail
 * screens (a lead, a card, the editor — M2 onwards) push on top of them, so
 * the tab bar hides while one is open.
 */
export default function SignedInLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
