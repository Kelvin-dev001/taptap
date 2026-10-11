import { randomUUID } from "expo-crypto";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import type { AppBlock, Profile } from "@/api/pages";
import { isBlockType } from "@taptap/core/draft";
import type { BlockType } from "@taptap/core/profile";
import {
  actionKeyboard,
  actionLabel,
  actionNeedsValue,
  actionPlaceholder,
  actionProblem,
  type ActionProblem,
} from "@/features/profile/blocks";
import { draftSync, usePendingDraft } from "@/features/profile/draft-sync-instance";
import { draftFromProfile } from "@/features/profile/model";
import { useProfiles } from "@/features/profile/use-profiles";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { ConfirmSheet } from "@/ui/confirm-sheet";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { SwitchRow } from "@/ui/switch";
import { TextField } from "@/ui/text-field";

/**
 * Add or edit one action (PLAN.md §7.1, `profile/[id]/action`). Opened with
 * `block=<id>` to edit, or `type=<type>` to add. The action joins the draft
 * only once it works — a WhatsApp button with half a number is worse than none.
 */
export default function ActionScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; block?: string; type?: string }>();
  const { pages } = useProfiles();
  const profile = pages.data?.find((p) => p.id === params.id);
  const pending = usePendingDraft(params.id);
  const draft = pending?.draft ?? (profile ? draftFromProfile(profile) : null);
  const existing = params.block ? draft?.blocks.find((b) => b.id === params.block) : undefined;
  const type = existing?.type ?? params.type;

  if (!profile || !draft || !type || !isBlockType(type) || (params.block && !existing)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("editor.action.editTitle") }} />
        <Notice tone="info" message={t("editor.notFound")} />
      </Screen>
    );
  }
  return <ActionForm profile={profile} type={type} existing={existing} />;
}

function ActionForm({ profile, type, existing }: { profile: Profile; type: BlockType; existing?: AppBlock }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(existing?.label ?? "");
  const [value, setValue] = useState(existing?.value ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [problem, setProblem] = useState<ActionProblem | null>(null);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const defaultLabel = actionLabel(t, type);
  const needsValue = actionNeedsValue(type);

  const update = (change: (blocks: AppBlock[]) => AppBlock[]) =>
    draftSync.update(profile.id, profile.updatedAt, draftFromProfile(profile), (d) => ({
      ...d,
      blocks: change(d.blocks),
    }));

  function done() {
    const found = actionProblem(type, value);
    setTried(true);
    setProblem(found);
    if (found) return;
    const block: AppBlock = {
      id: existing?.id ?? randomUUID(),
      type,
      label: label.trim(),
      value: needsValue ? value.trim() : "",
      isActive,
    };
    update((blocks) =>
      existing ? blocks.map((b) => (b.id === existing.id ? block : b)) : [...blocks, block],
    );
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: existing ? t("editor.action.editTitle") : t("editor.action.newTitle", { label: defaultLabel }),
        }}
      />
      <Card>
        {needsValue ? (
          <TextField
            label={t(`blocks.${type}.field`)}
            placeholder={actionPlaceholder(t, type)}
            value={value}
            onChangeText={(next) => {
              setValue(next);
              // Once the person has tried to save, say as they type when it is fixed.
              if (tried) setProblem(actionProblem(type, next));
            }}
            error={problem ? t(problem) : null}
            keyboardType={actionKeyboard(type)}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={!existing}
          />
        ) : (
          <Notice tone="info" message={t("editor.action.contactNote")} />
        )}
        <TextField
          label={t("editor.action.label")}
          hint={t("editor.action.labelHint", { label: defaultLabel })}
          placeholder={defaultLabel}
          value={label}
          onChangeText={setLabel}
        />
        <SwitchRow label={t("editor.action.show")} value={isActive} onValueChange={setIsActive} />
      </Card>

      <View style={styles.buttons}>
        <Button label={existing ? t("common.done") : t("editor.action.add")} onPress={done} />
        {existing ? (
          <Button label={t("editor.action.delete")} variant="danger" onPress={() => setConfirmDelete(true)} />
        ) : null}
      </View>

      <ConfirmSheet
        visible={confirmDelete}
        title={t("editor.action.deleteTitle")}
        body={t("editor.action.deleteBody")}
        confirmLabel={t("editor.action.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          if (existing) update((blocks) => blocks.filter((b) => b.id !== existing.id));
          setConfirmDelete(false);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: space.sm },
});
