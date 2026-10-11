import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOnline } from "@/features/network/use-online";
import type { SaveStatus } from "@/ui/save-state";
import { actionLabel } from "./blocks";
import { usePendingDraft, useSavedAt } from "./draft-sync-instance";

/** How long "Saved ✓" stays after a save lands. */
const SAVED_MS = 2500;

/**
 * The editor's save indicator, from the draft sync's state: Saving… while
 * edits wait or travel, Saved ✓ briefly once they land, and what is happening
 * when they cannot. A conflict is shown by the screen itself, with its choice.
 */
export function useSaveStatus(pageId: string): { status: SaveStatus; label: string } {
  const { t } = useTranslation();
  const online = useOnline();
  const pending = usePendingDraft(pageId);
  const savedAt = useSavedAt(pageId);
  const [now, setNow] = useState(() => Date.now());

  // Re-render once when "Saved ✓" should disappear.
  useEffect(() => {
    if (!savedAt) return;
    const left = savedAt + SAVED_MS - Date.now();
    if (left <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), left);
    return () => clearTimeout(timer);
  }, [savedAt]);

  if (pending) {
    switch (pending.state) {
      case "waiting":
      case "saving":
        return { status: "saving", label: t("editor.save.saving") };
      case "retrying":
        return online
          ? { status: "retrying", label: t("editor.save.retrying") }
          : { status: "offline", label: t("editor.save.offline") };
      case "invalid": {
        const index = pending.invalid?.index;
        const block = index === undefined ? undefined : pending.draft.blocks[index];
        return {
          status: "problem",
          label: block
            ? t("editor.save.invalidAction", { label: block.label || actionLabel(t, block.type) })
            : t("editor.save.invalid"),
        };
      }
      case "conflict":
        return { status: "idle", label: "" };
    }
  }
  if (savedAt && now < savedAt + SAVED_MS) {
    return { status: "saved", label: t("editor.save.saved") };
  }
  return { status: "idle", label: "" };
}
