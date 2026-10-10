import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "@/theme/motion";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Button } from "./button";
import { Text } from "./text";

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Red confirm button, for actions that remove something. */
  destructive?: boolean;
  busy?: boolean;
};

/**
 * "Are you sure?" as a sheet from the bottom, never a system alert (PLAN.md
 * §4.8). Tapping outside, Android's back button and Cancel all close it; the
 * confirm button sits where the thumb is.
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
  busy = false,
}: ConfirmSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onCancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.fill}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onCancel}
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
          <Text tone="foregroundSecondary">{body}</Text>
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={destructive ? "danger" : "primary"}
              onPress={onConfirm}
              loading={busy}
            />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: space.xl,
    gap: space.md,
  },
  actions: { gap: space.sm, marginTop: space.sm },
});
