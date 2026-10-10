import { useTranslation } from "react-i18next";
import { EmptyState } from "@/ui/empty-state";
import { CreditCard } from "@/ui/icons";
import { OfflineBanner } from "@/ui/offline-banner";
import { Screen } from "@/ui/screen";

/** Cards. Placeholder until M4 (list, detail, set up by NFC). */
export default function Cards() {
  const { t } = useTranslation();
  return (
    <Screen>
      <OfflineBanner message={t("offline.app")} />
      <EmptyState
        icon={CreditCard}
        title={t("cards.placeholderTitle")}
        body={t("cards.placeholderBody")}
      />
    </Screen>
  );
}
