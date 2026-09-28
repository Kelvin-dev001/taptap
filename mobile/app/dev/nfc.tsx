import * as Haptics from "expo-haptics";
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import {
  cancelScan,
  nfcAvailability,
  openNfcSettings,
  scanCard,
  type NfcAvailability,
  type ScanResult,
} from "@/features/nfc/reader";
import { devToolsEnabled } from "@/lib/build";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";

/**
 * The M0 NFC spike (PLAN.md §15): does react-native-nfc-manager v4 read a real
 * TapTap card on the Camon and the iPhone? It shows what was read and how long
 * it took. It never touches the network, and it does not exist in production
 * builds.
 */
export default function NfcCheck() {
  const { t } = useTranslation();
  const [availability, setAvailability] = useState<NfcAvailability | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ read: ScanResult; ms: number } | null>(null);

  useEffect(() => {
    void nfcAvailability().then(setAvailability);
    return () => {
      void cancelScan();
    };
  }, []);

  if (!devToolsEnabled) return <Redirect href="/" />;

  async function scan() {
    setResult(null);
    setScanning(true);
    const started = Date.now();
    const read = await scanCard(t("nfcCheck.iosAlert"), t("nfcCheck.iosSuccess"));
    setScanning(false);
    setResult({ read, ms: Date.now() - started });
    if (read.kind === "card") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (read.kind !== "cancelled") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }

  const status =
    availability === "ready"
      ? t("nfcCheck.statusReady")
      : availability === "disabled"
        ? t("nfcCheck.statusDisabled")
        : availability === "unsupported"
          ? t("nfcCheck.statusUnsupported")
          : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: t("nfcCheck.title") }} />

      <Text tone="foregroundSecondary">{t("nfcCheck.intro")}</Text>

      {status ? (
        <Text
          variant="cardTitle"
          tone={availability === "ready" ? "success" : "warning"}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Text>
      ) : null}

      {availability === "disabled" && Platform.OS === "android" ? (
        <Button
          label={t("nfcCheck.openSettings")}
          variant="secondary"
          onPress={() => void openNfcSettings()}
        />
      ) : null}

      <Button
        label={t("nfcCheck.scan")}
        loading={scanning}
        loadingLabel={t("nfcCheck.scanning")}
        disabled={availability !== "ready"}
        onPress={() => void scan()}
      />

      {scanning && Platform.OS === "android" ? (
        <Button label={t("nfcCheck.cancel")} variant="ghost" onPress={() => void cancelScan()} />
      ) : null}

      {result ? <ResultCard read={result.read} ms={result.ms} /> : null}
    </Screen>
  );
}

function ResultCard({ read, ms }: { read: ScanResult; ms: number }) {
  const { t } = useTranslation();

  return (
    <Card>
      {read.kind === "card" ? (
        <>
          <Text variant="sectionTitle" tone="success" accessibilityRole="header">
            {t("nfcCheck.resultCard")}
          </Text>
          <Field label={t("nfcCheck.resultToken")} value={read.token} />
          <Field label={t("nfcCheck.resultUrl")} value={read.url} />
        </>
      ) : read.kind === "other" ? (
        <>
          <Text variant="sectionTitle" tone="warning" accessibilityRole="header">
            {t("nfcCheck.resultNotTapTap")}
          </Text>
          <Field label={t("nfcCheck.resultUrl")} value={read.url} />
        </>
      ) : read.kind === "empty" ? (
        <Text variant="sectionTitle" tone="warning">
          {t("nfcCheck.resultEmpty")}
        </Text>
      ) : read.kind === "cancelled" ? (
        <Text tone="muted">{t("nfcCheck.resultCancelled")}</Text>
      ) : (
        <Text tone="dangerText">{t("nfcCheck.resultError", { message: read.message })}</Text>
      )}
      <Text variant="caption" tone="muted">
        {t("nfcCheck.elapsed", { ms })}
      </Text>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: space.xxs }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text variant="bodySm" selectable>
        {value}
      </Text>
    </View>
  );
}
