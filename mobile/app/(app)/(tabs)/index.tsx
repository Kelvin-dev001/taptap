import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { useAnalytics } from "@/api/analytics";
import { pageOpens } from "@taptap/core/analytics";
import { isNewActivity, percentChange } from "@taptap/core/metrics";
import { BusinessName } from "@/features/account/business-name";
import {
  livePage,
  pickProfile,
  previewPage,
  profileStatus,
  profileUrl,
} from "@/features/profile/model";
import { ProfileView } from "@/features/profile/profile-view";
import { selectProfile, useSelectedProfileId } from "@/features/profile/selection";
import { STATUS_TONE } from "@/features/profile/status";
import { ShareSheet } from "@/features/profile/share-sheet";
import { useProfiles, useProfileState } from "@/features/profile/use-profiles";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { ErrorState } from "@/ui/error-state";
import { Check, ChevronDown, House } from "@/ui/icons";
import { ListRow } from "@/ui/list-row";
import { Notice } from "@/ui/notice";
import { OfflineBanner } from "@/ui/offline-banner";
import { Screen } from "@/ui/screen";
import { Sheet } from "@/ui/sheet";
import { Skeleton } from "@/ui/skeleton";
import { MetricTile } from "@/ui/metric-tile";
import { Text } from "@/ui/text";

/**
 * Home (PLAN.md §6): the profile as customers see it, its status in one word,
 * and the three things an owner does most — share it, show its QR code, edit
 * it. Paints from cache first; pull down to refresh.
 */
export default function Home() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId, pages, cards, identities } = useProfiles();
  const week = useAnalytics(userId, 7);
  // The three numbers an owner checks most, against the 7 days before.
  const weekTiles = week.data
    ? [
        { key: "opens", label: t("analytics.opens"), value: pageOpens(week.data.totals), previous: pageOpens(week.data.previous) },
        { key: "clicks", label: t("metrics.click.label"), value: week.data.totals.click ?? 0, previous: week.data.previous.click ?? 0 },
        { key: "leads", label: t("metrics.lead.label"), value: week.data.leads, previous: week.data.previous_leads },
      ]
    : [];
  const rememberedId = useSelectedProfileId();
  const all = pages.data ?? [];
  const current = useProfileState(pickProfile(all, rememberedId), all, identities);
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);

  const refreshing = pages.isRefetching || cards.isRefetching;
  const refresh = () => {
    void pages.refetch();
    void cards.refetch();
    void week.refetch();
  };

  let body: ReactNode;
  if (!pages.data) {
    body = pages.isError ? (
      <Card>
        <ErrorState message={t("home.loadError")} onRetry={refresh} />
      </Card>
    ) : (
      <Card>
        <Skeleton width="50%" height={22} />
        <Skeleton height={16} />
        <Skeleton height={48} />
      </Card>
    );
  } else if (!current) {
    body = (
      <Card>
        <EmptyState icon={House} title={t("home.noProfileTitle")} body={t("home.noProfileBody")} />
      </Card>
    );
  } else {
    const { profile, draft, status } = current;
    const name = draft.title.trim() || null;
    const url = profileUrl(profile.slug);
    const reachable = status === "live" || status === "unpublished";
    const live = reachable ? livePage(profile) : null;

    body = (
      <>
        {all.length > 1 ? (
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel={t("home.switchProfile")}
            accessibilityHint={t("home.switchProfileHint")}
            style={styles.switcher}
          >
            <Text variant="bodySm" weight="medium" tone="accentText">
              {name ?? t("home.untitled")}
            </Text>
            <ChevronDown size={18} color={colors.accentText} />
          </Pressable>
        ) : null}

        <Card>
          <View style={styles.titleRow}>
            <Text variant="cardTitle" style={styles.title} numberOfLines={2}>
              {name ?? t("home.untitled")}
            </Text>
            <Badge tone={STATUS_TONE[status]} label={t(`status.${status}`)} />
          </View>
          <Text variant="bodySm" tone="foregroundSecondary">
            {t(`status.${status}Body`)}
          </Text>
          <Text variant="caption" tone="muted" selectable>
            {url.replace(/^https?:\/\//, "")}
          </Text>
          <View style={styles.buttons}>
            <Button label={t("home.share")} onPress={() => setSharing(true)} disabled={!reachable} />
            <View style={styles.row}>
              <View style={styles.half}>
                <Button
                  label={t("home.qr")}
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/qr/[id]", params: { id: profile.id } })}
                  disabled={!reachable}
                />
              </View>
              <View style={styles.half}>
                <Button
                  label={t("home.edit")}
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/profile/[id]/edit", params: { id: profile.id } })}
                />
              </View>
            </View>
          </View>
          {!reachable ? <Notice tone="info" message={t("home.notLiveYet")} /> : null}
        </Card>

        {week.data && week.data.pages > 0 ? (
          <Pressable
            onPress={() => router.push("/analytics")}
            accessibilityRole="button"
            accessibilityHint={t("home.weekHint")}
            style={styles.week}
          >
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("home.weekTitle")}
            </Text>
            <View style={styles.row}>
              {weekTiles.map((tile) => (
                <MetricTile
                  key={tile.key}
                  label={tile.label}
                  value={tile.value}
                  change={percentChange(tile.value, tile.previous)}
                  isNew={isNewActivity(tile.value, tile.previous)}
                  style={styles.third}
                />
              ))}
            </View>
          </Pressable>
        ) : null}

        <Text variant="sectionTitle" accessibilityRole="header">
          {live ? t("home.livePreview") : t("home.draftPreview")}
        </Text>
        {profile.mode === "redirect" ? (
          <Card>
            <Text tone="foregroundSecondary">
              {t("home.redirectsTo", { url: (live?.redirect_url ?? draft.redirectUrl) || "—" })}
            </Text>
          </Card>
        ) : (
          <ProfileView page={live ?? previewPage(profile, draft)} />
        )}

        <ShareSheet visible={sharing} onClose={() => setSharing(false)} name={name} url={url} />
        <Sheet visible={picking} title={t("home.profilesTitle")} onClose={() => setPicking(false)}>
          {all.map((p) => {
            const selected = p.id === profile.id;
            return (
              <ListRow
                key={p.id}
                title={p.title || t("home.untitled")}
                subtitle={t(`status.${profileStatus(p, all, identities)}`)}
                icon={selected ? Check : undefined}
                onPress={() => {
                  selectProfile(p.id);
                  setPicking(false);
                }}
              />
            );
          })}
        </Sheet>
      </>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <OfflineBanner message={t("offline.app")} />
      <View style={styles.greeting}>
        <Text variant="bodySm" tone="muted">
          {t("home.welcome")}
        </Text>
        <BusinessName />
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: space.xs },
  switcher: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 48 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  title: { flex: 1 },
  buttons: { gap: space.sm },
  row: { flexDirection: "row", gap: space.sm },
  half: { flex: 1 },
  week: { gap: space.sm },
  third: { flexBasis: 0 },
});
