import { useTranslation } from "react-i18next";
import { useMe } from "@/api/me";
import { useSignedInUser } from "@/auth/session";
import type { TypeRole } from "@/theme/typography";
import { Skeleton } from "@/ui/skeleton";
import { Text } from "@/ui/text";

/**
 * The business's name, from cache first. While it loads for the first time it
 * is a skeleton; if it cannot load (offline with nothing cached, or an error)
 * it says "Your business" rather than leaving a gap.
 */
export function BusinessName({ variant = "pageTitle" }: { variant?: TypeRole }) {
  const { t } = useTranslation();
  const user = useSignedInUser();
  const me = useMe(user?.id ?? null);

  if (me.data) {
    return (
      <Text variant={variant} accessibilityRole="header">
        {me.data.businessName ?? t("account.businessUnknown")}
      </Text>
    );
  }
  if (me.isError || me.fetchStatus === "paused") {
    return (
      <Text variant={variant} accessibilityRole="header">
        {t("account.businessUnknown")}
      </Text>
    );
  }
  return <Skeleton width="60%" height={28} />;
}
