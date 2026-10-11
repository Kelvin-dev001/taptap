import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cardChangeErrorOf, linkCard, setCardOn, type Card } from "@/api/cards";
import { useOnline } from "@/features/network/use-online";
import { useToast } from "@/ui/toast";

/**
 * Linking a card to a profile and switching it on or off: the database
 * functions the web uses, which check ownership and the live-profile rule
 * themselves (0020, D-021). Never queued — a customer could tap the card
 * while a change waited (PLAN.md §4.5).
 */
export function useCardActions() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  function updateCached(id: string, change: Partial<Card>) {
    queryClient.setQueriesData<Card[]>({ queryKey: ["cards"] }, (cards) =>
      cards?.map((c) => (c.id === id ? { ...c, ...change } : c)),
    );
  }

  async function run(work: () => Promise<void>): Promise<boolean> {
    if (!online) {
      toast.show(t("card.offline"));
      return false;
    }
    setBusy(true);
    try {
      await work();
      return true;
    } catch (error) {
      const reason = cardChangeErrorOf(error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error));
      toast.show(t(reason === "not_published" ? "setUp.notPublished" : reason === "not_found" ? "card.notFound" : "card.failed"));
      return false;
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ["cards"] });
      void queryClient.invalidateQueries({ queryKey: ["cardActivity"] });
    }
  }

  return {
    busy,
    online,
    link: (card: Card, pageId: string) =>
      run(async () => {
        await linkCard(card.id, pageId);
        updateCached(card.id, { smart_page_id: pageId, status: "assigned" });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }),
    setOn: (card: Card, on: boolean) =>
      run(async () => {
        await setCardOn(card.id, on);
        updateCached(card.id, { status: on ? "assigned" : "disabled" });
        toast.show(t(on ? "card.switchedOn" : "card.switchedOff"));
      }),
  };
}
