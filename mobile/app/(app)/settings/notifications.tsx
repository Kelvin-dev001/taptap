import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, StyleSheet, View } from "react-native";
import { useOnline } from "@/features/network/use-online";
import {
  askPermission,
  DEFAULT_PREFS,
  needsBackgroundHelp,
  registerThisPhone,
  setPrefs,
  type PushKind,
  type PushPrefs,
} from "@/features/push/push";
import { pushPermissionKey, pushPrefsKey, usePushPermission } from "@/features/push/use-push";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { SwitchRow } from "@/ui/switch";
import { Text } from "@/ui/text";
import { useToast } from "@/ui/toast";

const KINDS: PushKind[] = ["lead", "first_tap", "term"];
const HELP_STEPS = ["helpStep1", "helpStep2", "helpStep3"] as const;

/**
 * Notifications (PLAN.md §6 Account): whether this phone may show them, a
 * switch per kind (this phone only — set_push_prefs, 0034), and, on Tecno,
 * Infinix and itel phones, how to stop the battery saver from blocking them.
 */
export default function NotificationSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const queryClient = useQueryClient();
  const perm = usePushPermission();
  // Registering returns this phone's switches; null when it cannot register.
  const registered = useQuery<PushPrefs | null>({
    queryKey: pushPrefsKey,
    queryFn: registerThisPhone,
    enabled: perm.data === "granted",
    staleTime: 60_000,
  });
  const [saving, setSaving] = useState<PushKind | null>(null);
  const prefs = registered.data ?? DEFAULT_PREFS;

  async function toggle(kind: PushKind, value: boolean) {
    setSaving(kind);
    queryClient.setQueryData<PushPrefs | null>(pushPrefsKey, (p) => ({ ...(p ?? DEFAULT_PREFS), [kind]: value }));
    try {
      queryClient.setQueryData(pushPrefsKey, await setPrefs({ [kind]: value }));
    } catch {
      queryClient.setQueryData<PushPrefs | null>(pushPrefsKey, (p) => ({ ...(p ?? DEFAULT_PREFS), [kind]: !value }));
      toast.show(t("push.saveFailed"));
    } finally {
      setSaving(null);
    }
  }

  async function turnOn() {
    const result = await askPermission();
    queryClient.setQueryData(pushPermissionKey, result);
    if (result === "granted") void registered.refetch();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t("push.title") }} />

      {perm.data === "denied" ? (
        <Card>
          <Notice tone="info" message={t("push.blocked")} />
          <Button label={t("push.openSettings")} onPress={() => void Linking.openSettings()} />
        </Card>
      ) : perm.data === "undetermined" ? (
        <Card>
          <Text tone="foregroundSecondary">{t("push.explainerBody")}</Text>
          <Button label={t("push.turnOn")} onPress={() => void turnOn()} />
        </Card>
      ) : perm.data === "granted" ? (
        <Card>
          <Text variant="bodySm" tone="muted">
            {t("push.thisPhone")}
          </Text>
          {registered.data === null && !registered.isFetching ? (
            <Notice tone="info" message={online ? t("push.cannotRegister") : t("push.offline")} />
          ) : null}
          {KINDS.map((kind) => (
            <SwitchRow
              key={kind}
              label={t(`push.kinds.${kind}`)}
              description={t(`push.kinds.${kind}Hint`)}
              value={prefs[kind]}
              disabled={!online || registered.data === null || saving !== null}
              onValueChange={(v) => void toggle(kind, v)}
            />
          ))}
          <Text variant="caption" tone="muted">
            {t("push.privacy")}
          </Text>
        </Card>
      ) : null}

      {needsBackgroundHelp() ? (
        <Card>
          <Text variant="cardTitle" accessibilityRole="header">
            {t("push.helpTitle")}
          </Text>
          <Text variant="bodySm" tone="foregroundSecondary">
            {t("push.helpBody")}
          </Text>
          <View style={styles.steps}>
            {HELP_STEPS.map((key, i) => (
              <Text key={key} variant="bodySm">
                {`${i + 1}. ${t(`push.${key}`)}`}
              </Text>
            ))}
          </View>
          <Button label={t("push.openAppSettings")} variant="secondary" onPress={() => void Linking.openSettings()} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { gap: space.xs },
});
