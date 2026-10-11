import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { firstPageOnly, leadsKey, useLeadCounts, useLeads, type LeadFilter } from "@/api/leads";
import { useSignedInUser } from "@/auth/session";
import { LEAD_STATUSES, matchesQuery, type Lead, type LeadStatus } from "@taptap/core/leads";
import { LeadRow } from "@/features/leads/lead-row";
import { space } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { Chip } from "@/ui/chip";
import { EmptyState } from "@/ui/empty-state";
import { ErrorState } from "@/ui/error-state";
import { Inbox } from "@/ui/icons";
import { OfflineBanner } from "@/ui/offline-banner";
import { Skeleton } from "@/ui/skeleton";
import { Text } from "@/ui/text";
import { TextField } from "@/ui/text-field";

/**
 * Leads (PLAN.md §6): everyone who left their details, newest first, a page at
 * a time as the owner scrolls. Filter by status, with counts; search what is
 * loaded; pull to refresh. A list, not a scroll view, so 500 leads stay smooth
 * on a low-end phone — only the rows on screen are drawn.
 */
export default function Leads() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const user = useSignedInUser();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<LeadStatus | null>(null);
  const [query, setQuery] = useState("");
  const filter: LeadFilter = useMemo(() => ({ status, pageId: null }), [status]);
  const leads = useLeads(userId, filter);
  const counts = useLeadCounts(userId);
  const [refreshing, setRefreshing] = useState(false);

  const loaded = useMemo(() => leads.data?.pages.flat() ?? [], [leads.data]);
  const shown = useMemo(() => loaded.filter((l) => matchesQuery(l, query)), [loaded, query]);

  const open = useCallback((id: string) => router.push({ pathname: "/lead/[id]", params: { id } }), []);
  const renderItem = useCallback(({ item }: { item: Lead }) => <LeadRow lead={item} onPress={open} />, [open]);

  async function refresh() {
    setRefreshing(true);
    queryClient.setQueryData(leadsKey(userId ?? "", filter), firstPageOnly);
    await Promise.all([leads.refetch(), counts.refetch()]);
    setRefreshing(false);
  }

  const chips: { value: LeadStatus | null; label: string; count?: number }[] = [
    { value: null, label: t("leads.all"), count: counts.data?.all },
    ...LEAD_STATUSES.map((s) => ({ value: s, label: t(`leadStatus.${s}`), count: counts.data?.by_status[s] ?? (counts.data ? 0 : undefined) })),
  ];

  const header = (
    <View style={styles.header}>
      <OfflineBanner message={t("offline.app")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {chips.map((chip) => (
          <Chip
            key={chip.value ?? "all"}
            label={chip.label}
            count={chip.count}
            selected={status === chip.value}
            onPress={() => setStatus(chip.value)}
            accessibilityLabel={
              chip.count === undefined ? chip.label : t("leads.filterLabel", { status: chip.label, count: chip.count })
            }
          />
        ))}
      </ScrollView>
      {loaded.length > 0 || query ? (
        <TextField
          label={t("leads.searchLabel")}
          placeholder={t("leads.searchPlaceholder")}
          hint={t("leads.searchHint")}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
      ) : null}
    </View>
  );

  let empty: ReactElement | null = null;
  if (!leads.data) {
    empty = leads.isError ? (
      <ErrorState message={t("leads.loadError")} onRetry={() => void leads.refetch()} />
    ) : (
      <View style={styles.skeletons}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width="55%" height={18} />
            <Skeleton width="80%" height={14} />
          </View>
        ))}
      </View>
    );
  } else if (query) {
    empty = (
      <Text tone="muted" style={styles.note}>
        {t("leads.noMatches", { query })}
      </Text>
    );
  } else if (status) {
    empty = (
      <Text tone="muted" style={styles.note}>
        {t("leads.filteredEmpty")}
      </Text>
    );
  } else {
    empty = <EmptyState icon={Inbox} title={t("leads.emptyTitle")} body={t("leads.emptyBody")} />;
  }

  const footer =
    leads.isFetchingNextPage ? (
      <View style={styles.footer} accessibilityLabel={t("leads.loadingMore")}>
        <ActivityIndicator color={colors.muted} />
      </View>
    ) : leads.data && !leads.hasNextPage && loaded.length > 0 && !query ? (
      <Text variant="caption" tone="muted" style={[styles.note, styles.footer]}>
        {t("leads.end")}
      </Text>
    ) : null;

  return (
    <SafeAreaView edges={["left", "right"]} style={[styles.fill, { backgroundColor: colors.background }]}>
      <FlatList
        data={shown}
        keyExtractor={(l) => l.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={() => {
          if (leads.hasNextPage && !leads.isFetchingNextPage && !query) void leads.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accentText}
            colors={[colors.accentFill]}
            progressBackgroundColor={colors.surface}
          />
        }
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: space.xxl },
  header: { padding: space.lg, gap: space.md },
  chips: { gap: space.sm },
  skeletons: { paddingHorizontal: space.lg, gap: space.lg },
  skeletonRow: { gap: space.sm },
  note: { textAlign: "center", paddingHorizontal: space.lg, paddingVertical: space.xl },
  footer: { paddingVertical: space.lg },
});
