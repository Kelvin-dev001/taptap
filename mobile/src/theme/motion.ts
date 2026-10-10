import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The phone's "reduce motion" setting (PLAN.md §4.8). When it is on, things
 * appear and disappear without sliding or fading.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
