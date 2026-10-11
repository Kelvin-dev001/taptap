import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { useCardActivity, type Card } from "@/api/cards";
import { CARD_TONE, cardBadge, cardName, cardTermLine } from "@/features/cards/model";
import { useProfiles } from "@/features/profile/use-profiles";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card as Panel } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { ErrorState } from "@/ui/error-state";
import { ChevronRight, CreditCard } from "@/ui/icons";
import { OfflineBanner } from "@/ui/offline-banner";
import { Screen } from "@/ui/screen";
import { Skeleton } from "@/ui/skeleton";
import { Text } from "@/ui/text";

/**
 * Cards (PLAN.md §6): each card and stand, what it opens, whether it is
 * active — in neutral words, never a renewal prompt (§3) — and its taps in the
 * last 30 days. "Set up a card" reads one by NFC, or by its serial.
 */
export default function Cards() {
  const { t } = useTranslation();
  const { userId, pages, cards } = useProfiles();
  const activity = useCardActivity(userId);
  const titles = new Map((pages.data ?? []).map((p) => [p.id, p.title || t("home.untitled")]));

  const refresh = () => {
    void cards.refetch();
    void activity.refetch();
  };

  let body;
  if (!cards.data) {
    body = cards.isError ? (
      <ErrorState message={t("cards.loadError")} onRetry={refresh} />
    ) : (
      <Panel>
        <Skeleton width="50%" height={20} />
        <Skeleton height={16} />
      </Panel>
    );
  } else if (cards.data.length === 0) {
    body = (
      <Panel>
        <EmptyState icon={CreditCard} title={t("cards.emptyTitle")} body={t("cards.emptyBody")} />
      </Panel>
    );
  } else {
    body = cards.data.map((card) => (
      <CardRow
        key={card.id}
        card={card}
        profile={card.smart_page_id ? titles.get(card.smart_page_id) : undefined}
        taps={activity.data?.[card.id]?.taps}
      />
    ));
  }

  return (
    <Screen refreshing={cards.isRefetching || activity.isRefetching} onRefresh={refresh}>
      <OfflineBanner message={t("offline.app")} />
      <Button
        label={t("cards.setUp")}
        accessibilityHint={t("cards.setUpHint")}
        onPress={() => router.push("/card/set-up")}
      />
      {body}
    </Screen>
  );
}

function CardRow({ card, profile, taps }: { card: Card; profile?: string; taps?: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const name = cardName(t, card);
  const badge = cardBadge(card);
  const opens = card.isPlaceholder ? null : profile ? t("cards.opens", { profile }) : t("cards.notLinked");

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/card/[id]", params: { id: card.id } })}
      accessibilityRole="button"
      accessibilityLabel={[name, t(`cards.badge.${badge}`), opens, taps === undefined ? null : t("cards.taps", { count: taps })]
        .filter(Boolean)
        .join(". ")}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surfaceSunken : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.top}>
          <Text variant="cardTitle" numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Badge tone={CARD_TONE[badge]} label={t(`cards.badge.${badge}`)} />
        </View>
        {opens ? (
          <Text variant="bodySm" tone={profile ? "foregroundSecondary" : "warning"} numberOfLines={1}>
            {opens}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {taps === undefined ? cardTermLine(t, card) : `${cardTermLine(t, card)} · ${t("cards.taps", { count: taps })}`}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
  },
  body: { flex: 1, gap: space.xxs },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1 },
});
