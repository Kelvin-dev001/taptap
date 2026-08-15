"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, EyeOff, Eye } from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  IconButton,
  ConfirmDialog,
  useToast,
} from "@/components/ui";
import { deleteProfileAction, setProfileActiveAction } from "./actions";

/**
 * Per-profile overflow menu — the delete and deactivate controls that UI-0
 * found missing (audit item B12).
 *
 * Deleting is irreversible and frees the slug, so it goes through
 * ConfirmDialog with the consequences spelled out (WCAG 3.3.4).
 */
export function ProfileActionsMenu({
  pageId,
  name,
  isActive,
}: {
  pageId: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function toggleActive() {
    const res = await setProfileActiveAction(pageId, !isActive);
    if (res.error) {
      toast({ title: "Could not update link", description: res.error, tone: "danger" });
      return;
    }
    toast({
      title: isActive ? "Link deactivated" : "Link reactivated",
      description: isActive
        ? "Taps now show a not-found page."
        : "Taps resolve to this link again.",
      tone: isActive ? "warning" : "success",
    });
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await deleteProfileAction(pageId);
    setBusy(false);
    setConfirmOpen(false);
    if (res.error) {
      toast({ title: "Could not delete link", description: res.error, tone: "danger" });
      return;
    }
    toast({ title: `Deleted ${name}`, tone: "success" });
    router.refresh();
  }

  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <IconButton label={`More options for ${name}`} size="md">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={toggleActive}>
            {isActive ? (
              <>
                <EyeOff className="h-4 w-4" aria-hidden="true" />
                Deactivate
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" aria-hidden="true" />
                Reactivate
              </>
            )}
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem destructive onSelect={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </DropdownItem>
        </DropdownContent>
      </Dropdown>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${name}?`}
        description="This cannot be undone. The link stops working, its analytics and leads are removed, and any NFC card pointing at it becomes unassigned until you link it to another page."
        confirmLabel="Delete link"
        destructive
        loading={busy}
        onConfirm={remove}
      />
    </>
  );
}
