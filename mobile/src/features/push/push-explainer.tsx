import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Bell } from "@/ui/icons";
import { Text } from "@/ui/text";
import { useToast } from "@/ui/toast";
import { askPermission, registerThisPhone } from "./push";
import { dismissExplainer, pushPermissionKey, pushPrefsKey, useExplainerDismissed, usePushPermission } from "./use-push";

/**
 * Home's "turn on notifications" card (PLAN.md §4.7). The operating system's
 * prompt comes only after "Turn on", so an owner knows what they are agreeing
 * to; "Not now" puts the card away for good (the switch lives in Account).
 */
export function PushExplainer() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const perm = usePushPermission();
  const dismissed = useExplainerDismissed();
  const [busy, setBusy] = useState(false);

  if (perm.data !== "undetermined" || dismissed !== false) return null;

  async function turnOn() {
    setBusy(true);
    const result = await askPermission();
    queryClient.setQueryData(pushPermissionKey, result);
    if (result === "granted") {
      const prefs = await registerThisPhone();
      if (prefs) queryClient.setQueryData(pushPrefsKey, prefs);
      toast.show(t("push.on"));
    } else {
      toast.show(t("push.refused"));
      dismissExplainer();
    }
    setBusy(false);
  }

  return (
    <Card>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Bell size={22} color={colors.accentText} />
        </View>
        <View style={styles.text}>
          <Text variant="cardTitle">{t("push.explainerTitle")}</Text>
          <Text variant="bodySm" tone="foregroundSecondary">
            {t("push.explainerBody")}
          </Text>
        </View>
      </View>
      <Button label={t("push.turnOn")} onPress={() => void turnOn()} loading={busy} />
      <Button label={t("push.notNow")} variant="ghost" onPress={dismissExplainer} disabled={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: space.md },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: space.xxs },
});
