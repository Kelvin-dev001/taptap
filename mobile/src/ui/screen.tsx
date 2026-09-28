import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";

type ScreenProps = PropsWithChildren<{
  /** Screens without a navigation header also need the top inset. */
  edges?: Edge[];
}>;

/** Page background, safe areas and scrolling, the same on every screen. */
export function Screen({ children, edges = ["bottom", "left", "right"] }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
});
