import type { PropsWithChildren } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "@/theme/motion";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Text } from "./text";

type SheetProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>;

/**
 * A panel from the bottom for a short choice — which profile, share how.
 * Tapping outside and Android's back button close it, like ConfirmSheet.
 */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.fill}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceElevated, paddingBottom: insets.bottom + space.lg },
          ]}
        >
          <Text variant="sectionTitle" accessibilityRole="header">
            {title}
          </Text>
          <ScrollView style={styles.body} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    gap: space.md,
  },
  body: { flexGrow: 0 },
  content: { gap: space.xs },
});
