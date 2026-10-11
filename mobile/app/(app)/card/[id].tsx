import { useMutation } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { RENAME_CARD, type CardRename } from "@/api/card-edits";
import { useCardActivity, type Card } from "@/api/cards";
import { CARD_TONE, cardBadge, cardName, cardTermLine, linkableProfiles } from "@/features/cards/model";
import { useCardActions } from "@/features/cards/use-card-actions";
import { useProfiles } from "@/features/profile/use-profiles";
import { formatAgo, formatDate, formatNumber } from "@/i18n/format";
import { space } from "@/theme/tokens";
import { Badge } from "@/ui/badge";
import { Card as Panel } from "@/ui/card";
import { ConfirmSheet } from "@/ui/confirm-sheet";
import { Check } from "@/ui/icons";
import { ListRow } from "@/ui/list-row";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { Sheet } from "@/ui/sheet";
import { SwitchRow } from "@/ui/switch";
import { Text } from "@/ui/text";
import { TextField } from "@/ui/text-field";
import { useToast } from "@/ui/toast";

/**
 * One card (PLAN.md §6): its name (saved even offline), what it opens, on or
 * off, its term in neutral words, and its taps. A change shows up on the next
 * tap: the card's link never changes, only where it points (CLAUDE.md §18).
 */
export default function CardScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards } = useProfiles();
  const card = cards.data?.find((c) => c.id === id);

  if (!card) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("card.title") }} />
        {cards.data ? <Notice tone="info" message={t("card.notFound")} /> : null}
      </Screen>
    );
  }
  return <CardDetail card={card} />;
}

function CardDetail({ card }: { card: Card }) {
  const { t } = useTranslation();
  const { userId, pages } = useProfiles();
  const activity = useCardActivity(userId).data?.[card.id];
  const actions = useCardActions();
  const toast = useToast();
  const [name, setName] = useState(card.label ?? "");
  const [picking, setPicking] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const { mutate: rename } = useMutation<void, Error, CardRename>({
    mutationKey: RENAME_CARD,
    scope: { id: `card:${card.id}` },
  });

  const all = pages.data ?? [];
  const live = linkableProfiles(all);
  const current = all.find((p) => p.id === card.smart_page_id);
  const badge = cardBadge(card);
  const on = card.status !== "disabled";

  function saveName() {
    if ((card.label ?? "") !== name.trim()) rename({ id: card.id, label: name });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: cardName(t, card) }} />
      <View style={styles.header}>
        <Badge tone={CARD_TONE[badge]} label={t(`cards.badge.${badge}`)} />
        <Text tone="foregroundSecondary">{cardTermLine(t, card)}</Text>
      </View>

      <Panel>
        <TextField
          label={t("card.name")}
          hint={t("card.nameHint")}
          placeholder={t("card.namePlaceholder")}
          value={name}
          onChangeText={setName}
          onBlur={saveName}
          onSubmitEditing={saveName}
          returnKeyType="done"
          maxLength={60}
        />
      </Panel>

      {card.isPlaceholder ? null : (
        <Panel>
          <ListRow
            title={t("card.opens")}
            subtitle={current ? current.title || t("home.untitled") : t("cards.notLinked")}
            onPress={() => setPicking(true)}
            accessibilityHint={t("card.chooseProfile")}
          />
          <SwitchRow
            label={t("card.on")}
            description={t("card.onHint")}
            value={on}
            disabled={actions.busy}
            onValueChange={(next) => {
              if (next) void actions.setOn(card, true);
              else setConfirmOff(true);
            }}
          />
          {!actions.online ? <Notice tone="offline" message={t("card.offline")} /> : null}
        </Panel>
      )}

      <Panel>
        <Info label={t("card.kind")} value={card.kind === "stand" ? t("cards.stand") : t("cards.card")} />
        {card.serial ? <Info label={t("card.serial")} value={card.serial} /> : null}
        <Info label={t("card.taps")} value={formatNumber(activity?.taps ?? 0)} />
        <Info label={t("card.lastTap")} value={activity?.lastTap ? formatAgo(t, activity.lastTap) : t("card.never")} />
        {card.claimed_at ? <Info label={t("card.since")} value={formatDate(card.claimed_at)} /> : null}
      </Panel>

      <Sheet visible={picking} title={t("card.chooseProfile")} onClose={() => setPicking(false)}>
        <Text variant="bodySm" tone="muted">
          {live.length > 0 ? t("card.onlyLive") : t("card.noLiveProfiles")}
        </Text>
        {live.map((p) => (
          <ListRow
            key={p.id}
            title={p.title || t("home.untitled")}
            icon={p.id === card.smart_page_id ? Check : undefined}
            onPress={async () => {
              setPicking(false);
              if (p.id === card.smart_page_id) return;
              if (await actions.link(card, p.id)) {
                toast.show(t("card.linked", { profile: p.title || t("home.untitled") }));
              }
            }}
          />
        ))}
      </Sheet>

      <ConfirmSheet
        visible={confirmOff}
        title={t("card.offTitle")}
        body={t("card.offBody")}
        confirmLabel={t("card.offConfirm")}
        cancelLabel={t("common.cancel")}
        destructive
        busy={actions.busy}
        onCancel={() => setConfirmOff(false)}
        onConfirm={async () => {
          await actions.setOn(card, false);
          setConfirmOff(false);
        }}
      />
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text variant="bodySm" tone="muted">
        {label}
      </Text>
      <Text variant="bodySm" selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  info: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
});
