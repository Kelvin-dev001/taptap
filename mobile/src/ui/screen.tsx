import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";

type ScreenProps = PropsWithChildren<{
  /** Screens without a navigation header also need the top inset. */
  edges?: Edge[];
}>;

/**
 * Page background, safe areas, scrolling and the keyboard, the same on every
 * screen. Taps on buttons land while the keyboard is open (`handled`), so a
 * form's submit button works on the first press.
 */
export function Screen({ children, edges = ["bottom", "left", "right"] }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.grow}
        >
          <View style={styles.content}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { padding: space.lg, gap: space.lg },
});
