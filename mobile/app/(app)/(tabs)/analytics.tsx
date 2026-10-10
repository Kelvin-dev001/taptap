import { useTranslation } from "react-i18next";
import { EmptyState } from "@/ui/empty-state";
import { ChartColumn } from "@/ui/icons";
import { OfflineBanner } from "@/ui/offline-banner";
import { Screen } from "@/ui/screen";

/** Analytics. Placeholder until M3. */
export default function Analytics() {
  const { t } = useTranslation();
  return (
    <Screen>
      <OfflineBanner message={t("offline.app")} />
      <EmptyState
        icon={ChartColumn}
        title={t("analytics.placeholderTitle")}
        body={t("analytics.placeholderBody")}
      />
    </Screen>
  );
}
