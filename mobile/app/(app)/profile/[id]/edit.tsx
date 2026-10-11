import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { useMe } from "@/api/me";
import type { Profile } from "@/api/pages";
import { useSignedInUser } from "@/auth/session";
import type { IdentityRow } from "@taptap/core/identity";
import type { Contact, PageConfig, Theme } from "@taptap/core/profile";
import { templateOf } from "@taptap/core/templates";
import { isSafeDestination } from "@taptap/core/url";
import { draftSync, usePendingDraft } from "@/features/profile/draft-sync-instance";
import { ActionPicker } from "@/features/profile/editor/action-picker";
import { ActionRow } from "@/features/profile/editor/action-row";
import { ColourPicker } from "@/features/profile/editor/colour-picker";
import { PhotoField } from "@/features/profile/editor/photo-field";
import { canPublish, draftFromProfile, leadCaptureAllowed, type EditorDraft } from "@/features/profile/model";
import { STATUS_TONE } from "@/features/profile/status";
import { useProfiles, useProfileState } from "@/features/profile/use-profiles";
import { usePublish } from "@/features/profile/use-publish";
import { useSaveStatus } from "@/features/profile/use-save-status";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { ConfirmSheet } from "@/ui/confirm-sheet";
import { ErrorState } from "@/ui/error-state";
import { ChevronDown, ChevronRight } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { OfflineBanner } from "@/ui/offline-banner";
import { SaveState } from "@/ui/save-state";
import { Screen } from "@/ui/screen";
import { SegmentedControl } from "@/ui/segmented-control";
import { Skeleton } from "@/ui/skeleton";
import { SwitchRow } from "@/ui/switch";
import { Text } from "@/ui/text";
import { TextField } from "@/ui/text-field";

/**
 * The profile editor (PLAN.md §6, §8). Every change saves itself a moment
 * after typing stops — offline too, synced later — and nothing goes public
 * until Publish. What can be edited is what a card owner changes week to week;
 * the slug, the profile type and SEO stay on the website.
 */
export default function EditProfile() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pages } = useProfiles();
  const profile = pages.data?.find((p) => p.id === id) ?? null;

  if (!profile) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("editor.title") }} />
        {pages.data ? (
          <Notice tone="info" message={t("editor.notFound")} />
        ) : pages.isError ? (
          <ErrorState message={t("editor.loadError")} onRetry={() => void pages.refetch()} />
        ) : (
          <Card>
            <Skeleton width="40%" height={20} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </Card>
        )}
      </Screen>
    );
  }
  return <Editor id={profile.id} />;
}

/**
 * When a save lands, the cache and the unsent-edits store change together. The
 * query's observers hear about the cache a moment later than the store's
 * subscribers do, but useQuery reads the cache afresh on every render. So this
 * component subscribes to the store as well: it re-renders on the same tick,
 * reads the saved profile, and hands the body both halves at once. Otherwise
 * the badge flashes the old status for a frame after every save.
 */
function Editor({ id }: { id: string }) {
  usePendingDraft(id);
  const { pages, identities } = useProfiles();
  const all = pages.data ?? [];
  const profile = all.find((p) => p.id === id);
  return profile ? <EditorBody profile={profile} all={all} identities={identities} /> : null;
}

function EditorBody({
  profile,
  all,
  identities,
}: {
  profile: Profile;
  all: Profile[];
  identities: IdentityRow[];
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const user = useSignedInUser();
  const me = useMe(user?.id ?? null);
  const state = useProfileState(profile, all, identities)!;
  const pending = usePendingDraft(profile.id);
  const save = useSaveStatus(profile.id);
  const { publish, unpublish, busy, online } = usePublish(profile, state.draft);
  const [picking, setPicking] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const isCard = templateOf(state.draft.config) === "card";
  const [contactOpen, setContactOpen] = useState(isCard);

  const { draft, status } = state;
  const update = (change: (d: EditorDraft) => EditorDraft) =>
    draftSync.update(profile.id, profile.updatedAt, draftFromProfile(profile), change);
  const setConfig = (patch: Partial<PageConfig>) => update((d) => ({ ...d, config: { ...d.config, ...patch } }));
  const setTheme = (patch: Partial<Theme>) => update((d) => ({ ...d, theme: { ...d.theme, ...patch } }));
  const setContact = (patch: Partial<Contact>) =>
    update((d) => ({ ...d, config: { ...d.config, contact: { ...d.config.contact, ...patch } } }));

  const move = (index: number, by: -1 | 1) =>
    update((d) => {
      const blocks = [...d.blocks];
      const target = index + by;
      if (target < 0 || target >= blocks.length) return d;
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...d, blocks };
    });
  const toggle = (index: number, isActive: boolean) =>
    update((d) => ({ ...d, blocks: d.blocks.map((b, i) => (i === index ? { ...b, isActive } : b)) }));

  const live = status === "live";
  const published = profile.status === "published";
  const allowed = canPublish(profile, all, identities);
  const leadsAllowed = leadCaptureAllowed(identities);
  const redirectProblem =
    profile.mode === "redirect" && draft.redirectUrl.trim() !== "" && !isSafeDestination(draft.redirectUrl.trim());

  return (
    <Screen>
      <Stack.Screen options={{ title: t("editor.title") }} />
      <OfflineBanner message={t("editor.save.offline")} />

      <View style={styles.status}>
        <Badge tone={STATUS_TONE[status]} label={t(`status.${status}`)} />
        <SaveState status={save.status} label={save.label} />
      </View>

      {pending?.state === "conflict" ? (
        <Card style={{ borderColor: colors.warning }}>
          <Text variant="cardTitle" accessibilityRole="header">
            {t("editor.conflictTitle")}
          </Text>
          <Text variant="bodySm" tone="foregroundSecondary">
            {t("editor.conflictBody")}
          </Text>
          <Button label={t("editor.keepMine")} onPress={() => draftSync.resolveConflict(profile.id, "keepMine")} />
          <Button
            label={t("editor.useTheirs")}
            variant="secondary"
            onPress={() => {
              draftSync.resolveConflict(profile.id, "useTheirs");
              void queryClient.invalidateQueries({ queryKey: ["pages"] });
            }}
          />
        </Card>
      ) : null}

      {profile.mode === "redirect" ? (
        <Card>
          <TextField
            label={t("editor.redirect")}
            hint={t("editor.redirectHint")}
            value={draft.redirectUrl}
            onChangeText={(redirectUrl) => update((d) => ({ ...d, redirectUrl }))}
            error={redirectProblem ? t("editor.redirectInvalid") : null}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Card>
      ) : (
        <>
          <Card>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("editor.details")}
            </Text>
            <PhotoField
              label={isCard ? t("editor.photo") : t("editor.logo")}
              url={draft.config.avatarUrl}
              accountId={me.data?.accountId ?? null}
              pageId={profile.id}
              onChange={(avatarUrl) => setConfig({ avatarUrl })}
            />
            <TextField
              label={isCard ? t("editor.yourName") : t("editor.businessName")}
              value={draft.title}
              onChangeText={(title) => update((d) => ({ ...d, title }))}
              autoCapitalize="words"
            />
            {/* A card's line under the name comes from its contact card (lib/templates.ts). */}
            {!isCard ? (
              <TextField
                label={t("editor.tagline")}
                hint={t("editor.taglineHint")}
                placeholder={t("editor.taglinePlaceholder")}
                value={draft.config.tagline ?? ""}
                onChangeText={(tagline) => setConfig({ tagline })}
              />
            ) : null}
            <TextField
              label={t("editor.about")}
              placeholder={t("editor.aboutPlaceholder")}
              value={draft.config.bio ?? ""}
              onChangeText={(bio) => setConfig({ bio })}
              multiline
              textAlignVertical="top"
            />
          </Card>

          <Card>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("editor.actions")}
            </Text>
            <Text variant="bodySm" tone="muted">
              {draft.blocks.length > 0 ? t("editor.actionsHint") : t("editor.noActions")}
            </Text>
            <View>
              {draft.blocks.map((block, i) => (
                <ActionRow
                  key={block.id}
                  block={block}
                  first={i === 0}
                  last={i === draft.blocks.length - 1}
                  onEdit={() =>
                    router.push({ pathname: "/profile/[id]/action", params: { id: profile.id, block: block.id } })
                  }
                  onToggle={(isActive) => toggle(i, isActive)}
                  onMove={(by) => move(i, by)}
                />
              ))}
            </View>
            <Button label={t("editor.addAction")} variant="secondary" onPress={() => setPicking(true)} />
          </Card>

          <Card>
            <Pressable
              onPress={() => setContactOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: contactOpen }}
              style={styles.disclosure}
            >
              <View style={styles.disclosureText}>
                <Text variant="sectionTitle">{t("editor.contact")}</Text>
                <Text variant="bodySm" tone="muted">
                  {t("editor.contactHint")}
                </Text>
              </View>
              {contactOpen ? (
                <ChevronDown size={20} color={colors.muted} />
              ) : (
                <ChevronRight size={20} color={colors.muted} />
              )}
            </Pressable>
            {contactOpen ? (
              <>
                <TextField
                  label={t("editor.fullName")}
                  value={draft.config.contact?.fullName ?? ""}
                  onChangeText={(fullName) => setContact({ fullName })}
                  autoCapitalize="words"
                />
                <TextField
                  label={t("editor.org")}
                  value={draft.config.contact?.org ?? ""}
                  onChangeText={(org) => setContact({ org })}
                />
                <TextField
                  label={t("editor.jobTitle")}
                  value={draft.config.contact?.title ?? ""}
                  onChangeText={(title) => setContact({ title })}
                />
                <TextField
                  label={t("editor.phone")}
                  value={draft.config.contact?.phone ?? ""}
                  onChangeText={(phone) => setContact({ phone })}
                  keyboardType="phone-pad"
                />
                <TextField
                  label={t("editor.email")}
                  value={draft.config.contact?.email ?? ""}
                  onChangeText={(email) => setContact({ email })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextField
                  label={t("editor.website")}
                  value={draft.config.contact?.website ?? ""}
                  onChangeText={(website) => setContact({ website })}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : null}
          </Card>

          <Card>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("editor.look")}
            </Text>
            <SegmentedControl
              label={t("editor.style")}
              options={[
                { value: "light", label: t("editor.light") },
                { value: "dark", label: t("editor.dark") },
              ]}
              value={draft.theme.preset === "dark" ? "dark" : "light"}
              onChange={(preset) => setTheme({ preset })}
            />
            <Text variant="bodySm" weight="medium">
              {t("editor.buttonColour")}
            </Text>
            <ColourPicker
              label={t("editor.buttonColour")}
              value={draft.theme.accent}
              onChange={(accent) => setTheme({ accent })}
            />
            <Text variant="bodySm" tone="muted">
              {t("editor.colourHint")}
            </Text>
          </Card>

          <Card>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t("editor.leadForm")}
            </Text>
            {leadsAllowed ? (
              <>
                <SwitchRow
                  label={t("editor.leadFormSwitch")}
                  description={t("editor.leadFormDescription")}
                  value={draft.config.leadForm?.enabled ?? false}
                  onValueChange={(enabled) => setConfig({ leadForm: { ...draft.config.leadForm, enabled } })}
                />
                {draft.config.leadForm?.enabled ? (
                  <>
                    <TextField
                      label={t("editor.leadHeadline")}
                      placeholder={t("editor.leadHeadlinePlaceholder")}
                      value={draft.config.leadForm?.headline ?? ""}
                      onChangeText={(headline) => setConfig({ leadForm: { ...draft.config.leadForm, headline } })}
                    />
                    <TextField
                      label={t("editor.leadButton")}
                      placeholder={t("editor.leadButtonPlaceholder")}
                      value={draft.config.leadForm?.buttonLabel ?? ""}
                      onChangeText={(buttonLabel) =>
                        setConfig({ leadForm: { ...draft.config.leadForm, buttonLabel } })
                      }
                    />
                  </>
                ) : null}
              </>
            ) : (
              <Notice tone="info" message={t("editor.leadUnavailable")} />
            )}
          </Card>
        </>
      )}

      <View style={styles.footer}>
        {profile.mode === "page" ? (
          <Button
            label={t("editor.preview")}
            variant="secondary"
            onPress={() => router.push({ pathname: "/profile/[id]/preview", params: { id: profile.id } })}
          />
        ) : null}
        <Button
          label={published ? t("editor.publishChanges") : t("editor.publish")}
          onPress={() => void publish()}
          loading={busy === "publish"}
          loadingLabel={t("editor.publishing")}
          disabled={!online || !allowed || live || pending?.state === "conflict" || redirectProblem}
        />
        {!online ? (
          <Notice tone="offline" message={t("editor.publishOffline")} />
        ) : !allowed ? (
          <Notice tone="info" message={t("editor.publishBlocked")} />
        ) : live ? (
          <Text variant="bodySm" tone="muted" style={styles.center}>
            {t("editor.upToDate")}
          </Text>
        ) : null}
        {published ? (
          <Button
            label={t("editor.unpublish")}
            variant="ghost"
            onPress={() => setConfirmUnpublish(true)}
            disabled={!online || busy !== null}
          />
        ) : null}
      </View>

      <ActionPicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={(type) => {
          setPicking(false);
          router.push({ pathname: "/profile/[id]/action", params: { id: profile.id, type } });
        }}
      />
      <ConfirmSheet
        visible={confirmUnpublish}
        title={t("editor.unpublishTitle")}
        body={t("editor.unpublishBody")}
        confirmLabel={t("editor.unpublish")}
        cancelLabel={t("common.cancel")}
        destructive
        busy={busy === "unpublish"}
        onCancel={() => setConfirmUnpublish(false)}
        onConfirm={async () => {
          await unpublish();
          setConfirmUnpublish(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, flexWrap: "wrap" },
  disclosure: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  disclosureText: { flex: 1, gap: space.xxs },
  footer: { gap: space.sm },
  center: { textAlign: "center" },
});
