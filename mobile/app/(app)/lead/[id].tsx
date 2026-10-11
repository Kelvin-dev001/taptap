import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, StyleSheet, View } from "react-native";
import { findCachedLead, leadKey, removeLeadFromCaches, resyncLead, UPDATE_LEAD, type LeadEdit } from "@/api/lead-edits";
import { deleteLead, fetchLead, loadedLeads } from "@/api/leads";
import { contactChannels, LEAD_STATUSES, type Lead, type LeadStatus } from "@taptap/core/leads";
import { useOnline } from "@/features/network/use-online";
import { LEAD_TONE, leadName } from "@/features/leads/lead-row";
import { formatDateTime } from "@/i18n/format";
import { space } from "@/theme/tokens";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { ConfirmSheet } from "@/ui/confirm-sheet";
import { ErrorState } from "@/ui/error-state";
import { ListRow } from "@/ui/list-row";
import { Notice } from "@/ui/notice";
import { Screen } from "@/ui/screen";
import { SegmentedControl } from "@/ui/segmented-control";
import { Skeleton } from "@/ui/skeleton";
import { Text } from "@/ui/text";
import { TextField } from "@/ui/text-field";
import { useToast } from "@/ui/toast";

/** How long the note waits after typing stops before it is saved. */
const NOTE_DEBOUNCE_MS = 800;

/**
 * One lead (PLAN.md §6): what they sent, the ways to reach them — WhatsApp
 * first — their status and the owner's note, both of which save at once and
 * survive being offline, and their earlier enquiries.
 */
export default function LeadScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const lead = useQuery({
    queryKey: leadKey(id),
    queryFn: () => fetchLead(id),
    // Opened from the list: paint what the list already has, no wait.
    initialData: () => findCachedLead(queryClient, id),
    staleTime: 30_000,
  });

  if (!lead.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("lead.title") }} />
        {lead.data === null ? (
          <Notice tone="info" message={t("lead.notFound")} />
        ) : lead.isError ? (
          <ErrorState message={t("lead.loadError")} onRetry={() => void lead.refetch()} />
        ) : (
          <Card>
            <Skeleton width="50%" height={22} />
            <Skeleton height={48} />
          </Card>
        )}
      </Screen>
    );
  }
  return <LeadDetail lead={lead.data} />;
}

function LeadDetail({ lead }: { lead: Lead }) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(lead.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const savedNote = useRef(lead.note ?? "");

  // The send function, offline queueing and the optimistic update come from
  // the defaults registered for this key (src/api/lead-edits.ts); scope keeps
  // this lead's changes in order. An onError here replaces the default one,
  // so it re-syncs as well as saying so.
  const { mutate } = useMutation<void, Error, LeadEdit>({
    mutationKey: UPDATE_LEAD,
    scope: { id: `lead:${lead.id}` },
    onError: () => {
      resyncLead(queryClient, lead.id);
      toast.show(t("lead.saveFailed"));
    },
  });

  function setStatus(status: LeadStatus) {
    if (status === lead.status) return;
    void Haptics.selectionAsync();
    mutate({ id: lead.id, patch: { status } });
  }

  // Save the note a moment after typing stops, and on leaving the screen.
  const pendingNote = useRef<string | null>(null);
  useEffect(() => {
    if (note === savedNote.current) return;
    pendingNote.current = note;
    const timer = setTimeout(() => {
      pendingNote.current = null;
      savedNote.current = note;
      mutate({ id: lead.id, patch: { note: note.trim() ? note : null } });
    }, NOTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [note, lead.id, mutate]);
  useEffect(
    () => () => {
      const unsaved = pendingNote.current;
      if (unsaved !== null) mutate({ id: lead.id, patch: { note: unsaved.trim() ? unsaved : null } });
    },
    // Runs once, on leaving: the latest values are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function remove() {
    if (!online) {
      toast.show(t("lead.deleteOffline"));
      return;
    }
    setDeleting(true);
    try {
      await deleteLead(lead.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      removeLeadFromCaches(queryClient, lead);
      setConfirmDelete(false);
      router.back();
      toast.show(t("lead.deleted"));
    } catch {
      toast.show(t("lead.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  const name = leadName(t, lead);
  const channels = contactChannels(lead);
  // WhatsApp first: it is how Kenyan customers expect to be answered.
  const ordered = [...channels].sort((a, b) => (a.kind === "whatsapp" ? -1 : b.kind === "whatsapp" ? 1 : 0));
  const earlier = loadedLeads(
    queryClient.getQueriesData<InfiniteData<Lead[]>>({ queryKey: ["leads"] }).map(([, d]) => d),
  ).filter(
    (l) =>
      l.id !== lead.id &&
      ((lead.phone && l.phone === lead.phone) || (lead.email && l.email === lead.email)),
  );
  const notLoaded = Math.max(0, lead.repeat_count - earlier.length);

  return (
    <Screen>
      <Stack.Screen options={{ title: t("lead.title") }} />
      <View style={styles.header}>
        <Text variant="pageTitle" accessibilityRole="header">
          {name}
        </Text>
        <View style={styles.headerMeta}>
          <Badge tone={LEAD_TONE[lead.status]} label={t(`leadStatus.${lead.status}`)} />
          <Text variant="bodySm" tone="muted">
            {formatDateTime(lead.created_at)}
          </Text>
        </View>
      </View>

      {ordered.length > 0 ? (
        <View style={styles.buttons}>
          {ordered.map((c, i) => (
            <Button
              key={c.kind}
              label={t(`lead.${c.kind}`)}
              variant={i === 0 ? "primary" : "secondary"}
              onPress={() => void Linking.openURL(c.href)}
            />
          ))}
        </View>
      ) : (
        <Notice tone="info" message={t("lead.noContact")} />
      )}

      <Card>
        {lead.message ? <Field label={t("lead.message")} value={lead.message} /> : null}
        {lead.phone ? <Field label={t("lead.phone")} value={lead.phone} /> : null}
        {lead.email ? <Field label={t("lead.emailAddress")} value={lead.email} /> : null}
        {lead.company ? <Field label={t("lead.company")} value={lead.company} /> : null}
        {lead.page_title ? <Field label={t("lead.profile")} value={lead.page_title} /> : null}
        <Field label={t("lead.received")} value={formatDateTime(lead.created_at)} />
      </Card>

      <Card>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t("lead.status")}
        </Text>
        <SegmentedControl
          label={t("lead.status")}
          options={LEAD_STATUSES.map((s) => ({ value: s, label: t(`leadStatus.${s}`) }))}
          value={lead.status}
          onChange={setStatus}
        />
        <Text variant="bodySm" tone="muted">
          {t(`leadStatus.${lead.status}Hint`)}
        </Text>
        <TextField
          label={t("lead.note")}
          hint={t("lead.noteHint")}
          placeholder={t("lead.notePlaceholder")}
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
        />
      </Card>

      {earlier.length > 0 || notLoaded > 0 ? (
        <Card>
          <Text variant="sectionTitle" accessibilityRole="header">
            {t("lead.earlier")}
          </Text>
          {earlier.map((l) => (
            <ListRow
              key={l.id}
              title={formatDateTime(l.created_at)}
              subtitle={[t(`leadStatus.${l.status}`), l.message].filter(Boolean).join(" · ")}
              onPress={() => router.push({ pathname: "/lead/[id]", params: { id: l.id } })}
            />
          ))}
          {notLoaded > 0 ? (
            <Text variant="bodySm" tone="muted">
              {t("lead.earlierMore", { count: notLoaded })}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Button label={t("lead.delete")} variant="danger" onPress={() => setConfirmDelete(true)} />

      <ConfirmSheet
        visible={confirmDelete}
        title={t("lead.deleteTitle")}
        body={t("lead.deleteBody")}
        confirmLabel={t("lead.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: space.sm },
  buttons: { gap: space.sm },
  field: { gap: space.xxs },
});
