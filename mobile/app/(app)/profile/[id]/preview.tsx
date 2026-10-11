import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { usePendingDraft } from "@/features/profile/draft-sync-instance";
import { draftFromProfile, previewPage } from "@/features/profile/model";
import { ProfileView } from "@/features/profile/profile-view";
import { useProfiles } from "@/features/profile/use-profiles";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";

/** The draft full-screen, exactly as customers will see it after Publish. */
export default function PreviewScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pages } = useProfiles();
  const profile = pages.data?.find((p) => p.id === id);
  const pending = usePendingDraft(id);

  return (
    <Screen>
      <Stack.Screen options={{ title: t("preview.title") }} />
      {profile ? (
        <>
          <Notice tone="info" message={t("preview.banner")} />
          <ProfileView page={previewPage(profile, pending?.draft ?? draftFromProfile(profile))} />
        </>
      ) : (
        <Notice tone="info" message={t("editor.notFound")} />
      )}
    </Screen>
  );
}
