import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { BusinessName } from "@/features/account/business-name";
import { space } from "@/theme/tokens";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { House } from "@/ui/icons";
import { OfflineBanner } from "@/ui/offline-banner";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";

/** Home. M2 replaces the placeholder with the live profile, Share and the QR code. */
export default function Home() {
  const { t } = useTranslation();
  return (
    <Screen>
      <OfflineBanner message={t("offline.app")} />
      <View style={styles.greeting}>
        <Text variant="bodySm" tone="muted">
          {t("home.welcome")}
        </Text>
        <BusinessName />
      </View>
      <Card>
        <EmptyState
          icon={House}
          title={t("home.placeholderTitle")}
          body={t("home.placeholderBody")}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: space.xs },
});
