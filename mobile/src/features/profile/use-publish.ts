import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@/api/pages";
import { supabase } from "@/api/supabase";
import { useOnline } from "@/features/network/use-online";
import { isEntitlementError } from "@taptap/core/entitlement";
import { useToast } from "@/ui/toast";
import { draftSync } from "./draft-sync-instance";
import { previewPage, type EditorDraft } from "./model";

/** The cached profile as it will be after publishing, until the refetch lands. */
function asPublished(profile: Profile, draft: EditorDraft): Profile {
  const page = previewPage(profile, draft);
  return {
    ...profile,
    status: "published",
    publishedAt: new Date().toISOString(),
    publishedContent: {
      id: page.id,
      title: page.title,
      mode: page.mode,
      redirect_url: page.redirect_url,
      config: page.config,
      theme: page.theme,
      links: page.links.filter((l) => l.is_active !== false),
    },
  };
}

/**
 * Publish and Unpublish (PLAN.md §8 Editor): the database functions the web
 * uses, called as the signed-in person, so they enforce their own rules
 * (D-021). Both need the network — they are never queued (PLAN.md §4.5).
 *
 * Publishing first saves anything still unsent, because the snapshot is taken
 * from what the server has: publishing early would put the previous version
 * live while the owner looks at the new one.
 */
export function usePublish(profile: Profile | null, draft: EditorDraft | null) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"publish" | "unpublish" | null>(null);

  function updateCache(change: (p: Profile) => Profile) {
    if (!profile) return;
    queryClient.setQueriesData<Profile[]>({ queryKey: ["pages"] }, (pages) =>
      pages?.map((p) => (p.id === profile.id ? change(p) : p)),
    );
  }

  async function publish(): Promise<boolean> {
    if (!profile || !draft || busy) return false;
    if (!online) {
      toast.show(t("editor.publishOffline"));
      return false;
    }
    setBusy("publish");
    try {
      const saved = await draftSync.flush(profile.id);
      if (saved !== "saved") {
        toast.show(t("editor.saveFirstFailed"));
        return false;
      }
      const { error } = await supabase.rpc("publish_page", { p_page_id: profile.id });
      if (error) {
        toast.show(t(isEntitlementError(error.message) ? "editor.publishBlocked" : "editor.publishFailed"));
        return false;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateCache((p) => asPublished(p, draft));
      toast.show(t("editor.published"));
      return true;
    } catch {
      toast.show(t("editor.publishFailed"));
      return false;
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: ["pages"] });
    }
  }

  async function unpublish(): Promise<boolean> {
    if (!profile || busy) return false;
    if (!online) {
      toast.show(t("editor.publishOffline"));
      return false;
    }
    setBusy("unpublish");
    try {
      const { error } = await supabase.rpc("unpublish_page", { p_page_id: profile.id });
      if (error) {
        toast.show(t("editor.publishFailed"));
        return false;
      }
      updateCache((p) => ({ ...p, status: "draft" }));
      toast.show(t("editor.unpublishedToast"));
      return true;
    } catch {
      toast.show(t("editor.publishFailed"));
      return false;
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: ["pages"] });
    }
  }

  return { publish, unpublish, busy, online };
}
