import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useSession, useSignedInUser } from "@/auth/session";
import { BusinessName } from "@/features/account/business-name";
import { appVersion, devToolsEnabled, variant } from "@/lib/build";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { ConfirmSheet } from "@/ui/confirm-sheet";
import { Wrench } from "@/ui/icons";
import { ListRow } from "@/ui/list-row";
import { OfflineBanner } from "@/ui/offline-banner";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";
import { useToast } from "@/ui/toast";

/**
 * Account. M1: who is signed in, and signing out. Card terms, notifications,
 * help, privacy and deleting the account follow in M3–M6.
 */
export default function Account() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSignedInUser();
  const { signOut } = useSession();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmSignOut() {
    setBusy(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await signOut();
    // The guard moves to sign-in by itself; the toast outlives this screen.
    toast.show(t("account.signedOut"));
  }

  return (
    <Screen>
      <OfflineBanner message={t("offline.app")} />

      <Card>
        <View style={styles.identity}>
          <Text variant="label" tone="muted">
            {t("account.businessHeading")}
          </Text>
          <BusinessName variant="sectionTitle" />
          {user?.email ? (
            <Text variant="bodySm" tone="foregroundSecondary">
              {t("account.signedInAs", { email: user.email })}
            </Text>
          ) : null}
        </View>
      </Card>

      {devToolsEnabled ? (
        <Card>
          <ListRow
            icon={Wrench}
            title={t("account.devTools")}
            onPress={() => router.push("/dev/foundation")}
          />
        </Card>
      ) : null}

      <Button
        label={t("account.signOut")}
        variant="secondary"
        onPress={() => setConfirming(true)}
      />

      <Text variant="caption" tone="muted">
        {t("account.version", { variant, version: appVersion })}
      </Text>

      <ConfirmSheet
        visible={confirming}
        title={t("account.signOutTitle")}
        body={t("account.signOutBody")}
        confirmLabel={t("account.signOut")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void confirmSignOut()}
        onCancel={() => setConfirming(false)}
        busy={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { gap: space.xs },
});
