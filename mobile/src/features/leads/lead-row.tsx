import type { TFunction } from "i18next";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import type { Lead, LeadStatus } from "@taptap/core/leads";
import { formatAgo } from "@/i18n/format";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Badge, type BadgeTone } from "@/ui/badge";
import { Text } from "@/ui/text";

/** The web's tones for each status (lib/leads.ts STATUS_META), in the app's badge set. */
export const LEAD_TONE: Record<LeadStatus, BadgeTone> = {
  new: "warning",
  contacted: "neutral",
  won: "success",
  lost: "neutral",
};

/** Best name for a submission that may have left the name blank (lib/leads.ts, translated). */
export function leadName(t: TFunction, lead: Pick<Lead, "name" | "phone" | "email" | "company">): string {
  return (
    lead.name?.trim() || lead.phone?.trim() || lead.email?.trim() || lead.company?.trim() || t("leads.unnamed")
  );
}

/**
 * One lead in the inbox. A new one is in bold with an orange marker, so the
 * ones still to follow up stand out — the word "New" carries it too.
 */
export const LeadRow = memo(function LeadRow({ lead, onPress }: { lead: Lead; onPress: (id: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isNew = lead.status === "new";
  const name = leadName(t, lead);
  const meta = [lead.page_title, formatAgo(t, lead.created_at)].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={() => onPress(lead.id)}
      accessibilityRole="button"
      accessibilityLabel={[name, t(`leadStatus.${lead.status}`), meta, lead.message].filter(Boolean).join(". ")}
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.border },
        pressed ? { backgroundColor: colors.surfaceSunken } : null,
      ]}
    >
      <View style={[styles.marker, { backgroundColor: isNew ? colors.primary : "transparent" }]} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text variant="body" weight={isNew ? "semibold" : "regular"} numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Badge tone={LEAD_TONE[lead.status]} label={t(`leadStatus.${lead.status}`)} />
        </View>
        {lead.message ? (
          <Text variant="bodySm" tone="foregroundSecondary" numberOfLines={1}>
            {lead.message}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {lead.repeat_count > 0 ? `${meta} · ${t("leads.repeat", { count: lead.repeat_count })}` : meta}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.sm,
    paddingVertical: space.md,
    paddingRight: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  marker: { width: 4, borderRadius: 2, marginLeft: space.xs },
  body: { flex: 1, gap: space.xxs },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1 },
});
