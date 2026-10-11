import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { identifyForeignCard, type Card } from "@/api/cards";
import { cardName, findBySerial, linkableProfiles } from "@/features/cards/model";
import { useCardActions } from "@/features/cards/use-card-actions";
import { cancelScan, nfcAvailability, openNfcSettings, scanCard, type NfcAvailability } from "@/features/nfc/reader";
import { useOnline } from "@/features/network/use-online";
import { useProfiles } from "@/features/profile/use-profiles";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Button } from "@/ui/button";
import { Card as Panel } from "@/ui/card";
import { CircleCheck } from "@/ui/icons";
import { ListRow } from "@/ui/list-row";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";
import { TextField } from "@/ui/text-field";

type Step =
  | { kind: "start" }
  | { kind: "scanning" }
  | { kind: "serial"; problem?: string }
  | { kind: "problem"; message: string }
  | { kind: "found"; cardId: string }
  | { kind: "done"; cardId: string; profile: string };

/**
 * Set up a card (PLAN.md §4.6): hold it to the phone, the app finds which of
 * YOUR cards it is, and you choose the live profile it opens — rebind_tag, the
 * web's function, with its ownership and live-profile checks (0020, D-021).
 *
 * A card that is not yours cannot be claimed from here (D-027): an unowned
 * card "hasn't been activated", another account's card says so, and nothing
 * mentions buying one (PLAN.md §3). Reading a card records no tap.
 * No NFC, or NFC off: the serial printed on the card does the same job.
 */
export default function SetUpCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const online = useOnline();
  const { pages, cards } = useProfiles();
  const actions = useCardActions();
  const [availability, setAvailability] = useState<NfcAvailability | null>(null);
  const [step, setStep] = useState<Step>({ kind: "start" });
  const [serial, setSerial] = useState("");

  useEffect(() => {
    void nfcAvailability().then(setAvailability);
    return () => {
      void cancelScan();
    };
  }, []);

  const mine = cards.data ?? [];
  const live = linkableProfiles(pages.data ?? []);
  const found = step.kind === "found" ? mine.find((c) => c.id === step.cardId) : undefined;

  async function scan() {
    setStep({ kind: "scanning" });
    const read = await scanCard(t("setUp.iosAlert"), t("setUp.iosSuccess"));
    if (read.kind === "cancelled") return setStep({ kind: "start" });
    if (read.kind !== "card") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const message =
        read.kind === "other" ? t("setUp.notTapTap") : read.kind === "empty" ? t("setUp.empty") : t("setUp.readFailed");
      return setStep({ kind: "problem", message });
    }
    const card = mine.find((c) => c.token === read.token);
    if (card) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return setStep({ kind: "found", cardId: card.id });
    }
    // Not one of this account's: say whose, without claiming it (D-027).
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      const whose = await identifyForeignCard(read.token);
      const message =
        whose === "unactivated" ? t("setUp.unactivated") : whose === "someone_else" ? t("setUp.someoneElse") : t("setUp.unknown");
      setStep({ kind: "problem", message });
    } catch {
      setStep({ kind: "problem", message: t("setUp.offline") });
    }
  }

  function findSerial() {
    const card = findBySerial(mine, serial);
    if (!card) return setStep({ kind: "serial", problem: t("setUp.serialNotFound") });
    setStep({ kind: "found", cardId: card.id });
  }

  async function choose(card: Card, pageId: string, profile: string) {
    if (await actions.link(card, pageId)) setStep({ kind: "done", cardId: card.id, profile });
  }

  let body;
  switch (step.kind) {
    case "start":
    case "scanning":
      body = (
        <>
          <Text tone="foregroundSecondary">{t("setUp.intro")}</Text>
          {availability === "ready" ? (
            step.kind === "scanning" ? (
              <Panel>
                <View style={styles.scanning} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={colors.accentText} />
                  <Text>{t("setUp.scanning")}</Text>
                </View>
                <Button label={t("setUp.cancel")} variant="secondary" onPress={() => void cancelScan()} />
              </Panel>
            ) : (
              <Button label={t("setUp.scan")} onPress={() => void scan()} disabled={!online} />
            )
          ) : availability === "disabled" ? (
            <>
              <Notice tone="info" message={t("setUp.nfcOff")} />
              {Platform.OS === "android" ? (
                <Button label={t("setUp.openSettings")} onPress={() => void openNfcSettings()} />
              ) : null}
            </>
          ) : availability === "unsupported" ? (
            <Notice tone="info" message={t("setUp.noNfc")} />
          ) : null}
          {step.kind === "start" ? (
            <Button label={t("setUp.useSerial")} variant="ghost" onPress={() => setStep({ kind: "serial" })} />
          ) : null}
        </>
      );
      break;
    case "serial":
      body = (
        <Panel>
          <TextField
            label={t("setUp.serialLabel")}
            hint={t("setUp.serialHint")}
            value={serial}
            onChangeText={setSerial}
            error={step.problem ?? null}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={findSerial}
            returnKeyType="search"
          />
          <Button label={t("setUp.find")} onPress={findSerial} disabled={!serial.trim()} />
        </Panel>
      );
      break;
    case "problem":
      body = (
        <>
          <Notice tone="danger" message={step.message} />
          <Button label={t("setUp.tryAgain")} onPress={() => setStep({ kind: "start" })} />
        </>
      );
      break;
    case "found":
      body = found ? (
        <>
          <Text variant="sectionTitle" accessibilityRole="header">
            {t("setUp.found", { card: cardName(t, found) })}
          </Text>
          {found.isPlaceholder ? (
            <Notice tone="info" message={t("setUp.preparing")} />
          ) : found.status === "disabled" ? (
            <>
              <Notice tone="info" message={t("setUp.foundOff")} />
              <Button label={t("setUp.switchOn")} onPress={() => void actions.setOn(found, true)} loading={actions.busy} />
            </>
          ) : live.length === 0 ? (
            <Notice tone="info" message={t("card.noLiveProfiles")} />
          ) : (
            <Panel>
              <Text variant="cardTitle">{t("card.chooseProfile")}</Text>
              <Text variant="bodySm" tone="muted">
                {t("card.onlyLive")}
              </Text>
              {live.map((p) => (
                <ListRow
                  key={p.id}
                  title={p.title || t("home.untitled")}
                  subtitle={p.id === found.smart_page_id ? t("cards.opens", { profile: p.title || t("home.untitled") }) : undefined}
                  onPress={() => void choose(found, p.id, p.title || t("home.untitled"))}
                />
              ))}
            </Panel>
          )}
        </>
      ) : null;
      break;
    case "done": {
      const card = mine.find((c) => c.id === step.cardId);
      body = (
        <Panel>
          <View style={styles.done}>
            <CircleCheck size={40} color={colors.success} />
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("setUp.doneTitle")}
            </Text>
            <Text tone="foregroundSecondary" style={styles.center}>
              {t("setUp.doneBody", { card: card ? cardName(t, card) : t("cards.card"), profile: step.profile })}
            </Text>
          </View>
          <Button label={t("setUp.done")} onPress={() => router.back()} />
        </Panel>
      );
      break;
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t("setUp.title") }} />
      {!online && step.kind !== "done" ? <Notice tone="offline" message={t("setUp.offline")} /> : null}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scanning: { flexDirection: "row", alignItems: "center", gap: space.md },
  done: { alignItems: "center", gap: space.sm, paddingVertical: space.lg },
  center: { textAlign: "center" },
});
