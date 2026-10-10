import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, type ColorValue } from "react-native";
import { fontFamily } from "@/theme/typography";
import { useTheme } from "@/theme/use-theme";
import { ChartColumn, CircleUser, CreditCard, House, Inbox, type LucideIcon } from "@/ui/icons";
import { Text } from "@/ui/text";

/**
 * Five tabs, the brief's maximum (PLAN.md §7.2).
 *
 * JavaScript tabs rather than Expo Router's native tabs: they take the app's
 * own icons, font and colours on both platforms, and they do not need the
 * 967 KB Material Symbols font native tabs pull in on Android (PROGRESS.md
 * finding 6), which M7 can now strip.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const icon = (Icon: LucideIcon) =>
    function TabIcon({ color }: { color: ColorValue }) {
      return <Icon size={24} color={color} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fontFamily("semibold") },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        // Tab labels grow with the phone's font size, up to 1.3× (PLAN.md §4.8);
        // past that, five labels no longer fit side by side.
        tabBarLabel: ({ children, color }) => (
          <Text variant="caption" weight="medium" maxFontSizeMultiplier={1.3} style={{ color }}>
            {children}
          </Text>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarIcon: icon(House) }} />
      <Tabs.Screen name="leads" options={{ title: t("tabs.leads"), tabBarIcon: icon(Inbox) }} />
      <Tabs.Screen
        name="analytics"
        options={{ title: t("tabs.analytics"), tabBarIcon: icon(ChartColumn) }}
      />
      <Tabs.Screen
        name="cards"
        options={{ title: t("tabs.cards"), tabBarIcon: icon(CreditCard) }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t("tabs.account"), tabBarIcon: icon(CircleUser) }}
      />
    </Tabs>
  );
}
