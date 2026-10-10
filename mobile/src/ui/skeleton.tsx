import { useEffect, useState } from "react";
import { Animated, type DimensionValue } from "react-native";
import { useReducedMotion } from "@/theme/motion";
import { radius } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";

/**
 * A grey placeholder the size of what is loading. It breathes slowly; with
 * reduce motion on, it stays still. Hidden from screen readers — the screen
 * announces loading once, not per bar.
 */
export function Skeleton({
  width = "100%",
  height = 16,
}: {
  width?: DimensionValue;
  height?: number;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  // State rather than a ref: the value is created once and read while rendering.
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceSunken,
        opacity,
      }}
    />
  );
}
