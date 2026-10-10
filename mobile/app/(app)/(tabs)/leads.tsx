import { useTranslation } from "react-i18next";
import { EmptyState } from "@/ui/empty-state";
import { Inbox } from "@/ui/icons";
import { OfflineBanner } from "@/ui/offline-banner";
import { Screen } from "@/ui/screen";

/** Leads. Placeholder until M3. */
export default function Leads() {
  const { t } = useTranslation();
  return (
    <Screen>
      <OfflineBanner message={t("offline.app")} />
      <EmptyState
        icon={Inbox}
        title={t("leads.placeholderTitle")}
        body={t("leads.placeholderBody")}
      />
    </Screen>
  );
}
