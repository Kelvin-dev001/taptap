import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { completeOnboarding } from "@/features/onboarding/onboarding";
import { useReducedMotion } from "@/theme/motion";
import { radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Button } from "@/ui/button";
import { CreditCard, Share2, Smartphone, type LucideIcon } from "@/ui/icons";
import { Text } from "@/ui/text";

type Page = {
  icon: LucideIcon;
  title: "welcome.page1Title" | "welcome.page2Title" | "welcome.page3Title";
  body: "welcome.page1Body" | "welcome.page2Body" | "welcome.page3Body";
};

const PAGES: Page[] = [
  { icon: Smartphone, title: "welcome.page1Title", body: "welcome.page1Body" },
  { icon: Share2, title: "welcome.page2Title", body: "welcome.page2Body" },
  { icon: CreditCard, title: "welcome.page3Title", body: "welcome.page3Body" },
];

/**
 * Three welcome pages, shown once per install and skippable (PLAN.md §6).
 * Swipe or press Next. Finishing — or skipping — flips the root guard, which
 * moves to sign-in by itself.
 */
export default function Welcome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  function next() {
    if (last) return completeOnboarding();
    const target = page + 1;
    scroller.current?.scrollTo({ x: target * width, animated: !reduced });
    setPage(target);
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        {!last ? (
          <Button label={t("welcome.skip")} variant="ghost" onPress={completeOnboarding} />
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.fill}
      >
        {PAGES.map(({ icon: Icon, title, body }, i) => (
          <ScrollView
            key={title}
            style={{ width }}
            contentContainerStyle={styles.page}
            // Only the page on screen is read out; the others wait their turn.
            importantForAccessibility={i === page ? "auto" : "no-hide-descendants"}
            accessibilityElementsHidden={i !== page}
          >
            <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Icon size={44} color={colors.accentText} />
            </View>
            <Text variant="pageTitle" accessibilityRole="header" style={styles.center}>
              {t(title)}
            </Text>
            <Text tone="foregroundSecondary" style={styles.center}>
              {t(body)}
            </Text>
          </ScrollView>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t("welcome.pageOf", { current: page + 1, total: PAGES.length })}
        >
          {PAGES.map((p, i) => (
            <View
              key={p.title}
              style={[
                styles.dot,
                { backgroundColor: i === page ? colors.accentFill : colors.borderStrong },
                i === page ? styles.dotActive : null,
              ]}
            />
          ))}
        </View>
        <Button label={last ? t("welcome.start") : t("welcome.next")} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { minHeight: 48, alignItems: "flex-end", paddingHorizontal: space.sm },
  page: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingHorizontal: space.xxl,
    paddingVertical: space.xl,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  center: { textAlign: "center" },
  bottom: { padding: space.lg, gap: space.lg },
  dots: { flexDirection: "row", justifyContent: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  dotActive: { width: 24 },
});
