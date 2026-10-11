import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
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
import { Text } from "@/ui/text";

/**
 * Home (PLAN.md §6): the profile as customers see it, its status in one word,
 * and the three things an owner does most — share it, show its QR code, edit
 * it. Paints from cache first; pull down to refresh.
 */
export default function Home() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { pages, cards, identities } = useProfiles();
  const rememberedId = useSelectedProfileId();
  const all = pages.data ?? [];
  const current = useProfileState(pickProfile(all, rememberedId), all, identities);
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);

  const refreshing = pages.isRefetching || cards.isRefetching;
  const refresh = () => {
    void pages.refetch();
    void cards.refetch();
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
});
