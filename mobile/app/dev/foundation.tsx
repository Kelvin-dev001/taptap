import { Redirect, Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { formatNumber } from "@/i18n/format";
import { appVersion, devToolsEnabled, variant } from "@/lib/build";
import { Sentry, sentryEnabled } from "@/lib/sentry";
import { radius, space, type ColorTokens } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";

const SWATCHES: (keyof ColorTokens)[] = [
  "primary",
  "accentFill",
  "accentText",
  "foreground",
  "muted",
  "surface",
  "success",
  "warning",
  "dangerText",
  "info",
];

/**
 * M0's check screen: proof that the design system, i18n, crash reporting and
 * NFC work on a real phone. Since M1 it sits behind "Developer checks" on the
 * sign-in screen and in Account, in development and preview builds only.
 */
export default function Foundation() {
  const { t } = useTranslation();
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const [sentryStatus, setSentryStatus] = useState<string | null>(null);

  if (!devToolsEnabled) return <Redirect href="/" />;

  function sendTestError() {
    if (!sentryEnabled) {
      setSentryStatus(t("foundation.sentryOff"));
      return;
    }
    Sentry.captureException(new Error("Sentry test from the M0 foundation screen"));
    setSentryStatus(t("foundation.sentrySent"));
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t("dev.foundationTitle") }} />

      <View style={styles.header}>
        <Text variant="display" accessibilityRole="header">
          {t("foundation.title")}
        </Text>
        <Text tone="foregroundSecondary">{t("foundation.subtitle")}</Text>
      </View>

      <Card>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t("foundation.themeHeading")}
        </Text>
        <Text tone="muted">
          {scheme === "dark" ? t("foundation.themeDark") : t("foundation.themeLight")}
        </Text>
        <View
          style={styles.swatches}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {SWATCHES.map((key) => (
            <View key={key} style={styles.swatch}>
              <View
                style={[styles.chip, { backgroundColor: colors[key], borderColor: colors.border }]}
              />
              <Text variant="caption" tone="muted">
                {key}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t("foundation.typeHeading")}
        </Text>
        <Text variant="pageTitle">{t("foundation.typeSample")}</Text>
        <Text>{t("foundation.typeSample")}</Text>
        <Text variant="bodySm" tone="foregroundSecondary">
          {t("foundation.typeSample")}
        </Text>
        <View>
          <Text variant="metric">{formatNumber(1284)}</Text>
          <Text variant="caption" tone="muted">
            {t("foundation.metricLabel")}
          </Text>
        </View>
      </Card>

      <Card>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t("foundation.buttonsHeading")}
        </Text>
        <Button label={t("foundation.primary")} onPress={() => undefined} />
        <Button label={t("foundation.secondary")} variant="secondary" onPress={() => undefined} />
        <Button label={t("foundation.ghost")} variant="ghost" onPress={() => undefined} />
        <Button label={t("foundation.danger")} variant="danger" onPress={() => undefined} />
        <Button
          label={t("foundation.primary")}
          loading
          loadingLabel={t("foundation.saving")}
          onPress={() => undefined}
        />
      </Card>

      {devToolsEnabled ? (
        <Card>
          <Text variant="sectionTitle" accessibilityRole="header">
            {t("foundation.toolsHeading")}
          </Text>
          <Button label={t("foundation.nfcCheck")} onPress={() => router.push("/dev/nfc")} />
          <Button label={t("foundation.sentryTest")} variant="secondary" onPress={sendTestError} />
          {sentryStatus ? (
            <Text variant="bodySm" tone="muted" accessibilityLiveRegion="polite">
              {sentryStatus}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Text variant="caption" tone="muted">
        {t("foundation.build", { variant, version: appVersion })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm, paddingTop: space.lg },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  swatch: { alignItems: "center", gap: space.xs, width: 72 },
  chip: { width: 40, height: 40, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
