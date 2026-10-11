import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { profileUrl, qrTarget } from "@/features/profile/model";
import { QrCode } from "@/features/profile/qr-code";
import { useProfiles } from "@/features/profile/use-profiles";
import { radius, space } from "@/theme/tokens";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";

/**
 * Full-screen QR code to show a customer standing in front of you (PLAN.md §6).
 * Drawn on the phone, so it works with no signal. It encodes the same link as
 * the web's QR codes, `?src=qr` included, so scans are counted as scans.
 */
export default function QrScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pages } = useProfiles();
  const profile = pages.data?.find((p) => p.id === id);
  const { width } = useWindowDimensions();
  const size = Math.min(width - space.lg * 4, 360);

  return (
    <Screen>
      <Stack.Screen options={{ title: t("qr.title") }} />
      {profile ? (
        <View style={styles.center}>
          <View style={styles.card}>
            <QrCode
              value={qrTarget(profile.slug)}
              size={size}
              label={t("qr.label", { url: profileUrl(profile.slug) })}
            />
          </View>
          {profile.title ? (
            <Text variant="sectionTitle" style={styles.text}>
              {profile.title}
            </Text>
          ) : null}
          <Text variant="bodySm" tone="muted" style={styles.text} selectable>
            {profileUrl(profile.slug).replace(/^https?:\/\//, "")}
          </Text>
          <Text variant="bodySm" tone="foregroundSecondary" style={styles.text}>
            {t("qr.hint")}
          </Text>
        </View>
      ) : (
        <Notice tone="info" message={t("editor.notFound")} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space.md, paddingTop: space.lg },
  // White whatever the theme: a QR code needs a light quiet zone around it.
  card: { backgroundColor: "#ffffff", borderRadius: radius.xl, padding: space.lg },
  text: { textAlign: "center" },
});
