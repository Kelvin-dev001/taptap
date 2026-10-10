import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "@/theme/motion";
import { duration, radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Text } from "./text";

type Toast = { id: number; message: string };
type ToastContextValue = { show: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3500;

/**
 * Brief confirmations instead of alerts (brief: "toasts instead of alerts").
 * One at a time, near the top so neither the keyboard nor the tab bar covers
 * it; tapping dismisses it. Screen readers hear it as it appears.
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextId = useRef(1);

  const show = useCallback((message: string) => {
    setToast({ id: nextId.current++, message });
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const hide = useCallback(() => setToast(null), []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} message={toast.message} onDone={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ message, onDone }: { message: string; onDone: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // State rather than a ref: the value is created once and read while rendering.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const enter = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : duration.base,
      useNativeDriver: true,
    });
    enter.start();
    const timer = setTimeout(onDone, VISIBLE_MS);
    return () => {
      enter.stop();
      clearTimeout(timer);
    };
  }, [progress, reduced, onDone]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.layer,
        { top: insets.top + space.sm, opacity: progress, transform: [{ translateY }] },
      ]}
    >
      <Pressable
        onPress={onDone}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: colors.surfaceInverse }]}
      >
        <Text variant="bodySm" tone="onInverse">
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: space.lg, right: space.lg, alignItems: "center" },
  toast: {
    maxWidth: 480,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    // The web's soft shadow, translated (PLAN.md §4.8).
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
