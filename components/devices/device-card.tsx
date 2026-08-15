"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Nfc, QrCode, Pencil, RefreshCw, Check, X } from "lucide-react";
import {
  Card,
  Badge,
  Button,
  IconButton,
  Input,
  Field,
  Select,
  Drawer,
  DrawerTrigger,
  DrawerContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogFooter,
  DialogClose,
  useToast,
} from "@/components/ui";
import { QrPreview } from "@/components/qr/qr-preview";
import { relativeTime } from "@/lib/metrics";
import {
  renameTagAction,
  replaceTagAction,
  rebindTagAction,
  setTagStatusAction,
} from "@/app/dashboard/devices/actions";

export type Device = {
  id: string;
  token: string;
  label: string | null;
  status: string;
  smart_page_id: string | null;
  page_title: string | null;
  page_slug: string | null;
  claimed_at: string | null;
  taps: number;
  last_tap: string | null;
};

export type PageOption = { id: string; slug: string; title: string | null };

/**
 * One physical card.
 *
 * Named rather than identified by a token tail: a business with a card at the
 * till, one at reception and one per table cannot work with "···a7f2c1".
 */
export function DeviceCard({
  device,
  pages,
  rangeDays,
}: {
  device: Device;
  pages: PageOption[];
  rangeDays: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState(device.label ?? "");
  const [busy, setBusy] = React.useState(false);

  const displayName = device.label || `Card ···${device.token.slice(-6)}`;
  const bound = Boolean(device.smart_page_id);

  async function saveName() {
    setBusy(true);
    const res = await renameTagAction(device.id, name);
    setBusy(false);
    if (res.error) {
      toast({ title: "Could not rename card", description: res.error, tone: "danger" });
      return;
    }
    setRenaming(false);
    router.refresh();
  }

  return (
    <Card padding="sm" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
            <Nfc className="h-4 w-4 text-primary-strong" aria-hidden="true" />
          </span>

          <div className="flex min-w-0 flex-col">
            {renaming ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Reception desk"
                  aria-label="Card name"
                  className="h-8 w-44"
                  maxLength={60}
                  autoFocus
                />
                <IconButton label="Save name" size="md" onClick={saveName} disabled={busy}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label="Cancel rename"
                  size="md"
                  onClick={() => {
                    setName(device.label ?? "");
                    setRenaming(false);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="truncate text-card-title text-foreground">{displayName}</span>
                <IconButton label={`Rename ${displayName}`} size="sm" onClick={() => setRenaming(true)}>
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                </IconButton>
              </div>
            )}

            <span className="truncate text-caption text-muted">
              {bound ? `Points to ${device.page_title || `/${device.page_slug}`}` : "Not linked yet"}
            </span>
          </div>
        </div>

        <Badge
          variant={
            device.status === "assigned"
              ? "success"
              : device.status === "disabled"
                ? "danger"
                : "neutral"
          }
          dot
        >
          {device.status === "assigned"
            ? "Active"
            : device.status === "disabled"
              ? "Disabled"
              : "Unassigned"}
        </Badge>
      </div>

      {/* Real per-card numbers — impossible before events.tag_id (B4). */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-surface-sunken px-3 py-2">
        <span className="flex flex-col">
          <span className="tabular text-body-sm font-semibold text-foreground">
            {device.taps.toLocaleString()}
          </span>
          <span className="text-caption text-muted">taps · last {rangeDays}d</span>
        </span>
        <span className="flex flex-col">
          <span className="text-body-sm text-foreground">
            {device.last_tap ? relativeTime(device.last_tap) : "Never"}
          </span>
          <span className="text-caption text-muted">last tap</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={rebindTagAction} className="flex flex-1 flex-wrap items-end gap-2">
          <input type="hidden" name="tagId" value={device.id} />
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-caption text-muted">Points to</span>
            <Select name="pageId" required defaultValue={device.smart_page_id ?? ""}>
              {pages.length === 0 && <option value="">No profiles yet</option>}
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || `/${p.slug}`}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary" size="sm" disabled={pages.length === 0}>
            Repoint
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {device.page_slug && (
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="sm">
                <QrCode className="h-4 w-4" aria-hidden="true" />
                QR code
              </Button>
            </DrawerTrigger>
            <DrawerContent
              side="right"
              title={`QR for ${displayName}`}
              description="Encodes the card's permanent link, so renaming the profile never breaks a printed code."
            >
              <QrPreview slug={device.page_slug} token={device.token} label={displayName} />
            </DrawerContent>
          </Drawer>
        )}

        <ReplaceDialog device={device} displayName={displayName} />

        <form action={setTagStatusAction} className="ml-auto">
          <input type="hidden" name="tagId" value={device.id} />
          <input
            type="hidden"
            name="status"
            value={device.status === "disabled" ? "assigned" : "disabled"}
          />
          <Button type="submit" variant="ghost" size="sm">
            {device.status === "disabled" ? "Enable" : "Disable"}
          </Button>
        </form>
      </div>
    </Card>
  );
}

/**
 * Lost or damaged card flow. The swap happens server-side in one transaction so
 * there is never a moment where both the old and new card resolve.
 */
function ReplaceDialog({ device, displayName }: { device: Device; displayName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await replaceTagAction(device.id, token);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setToken("");
    toast({ title: "Card replaced", description: res.success, tone: "success" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Replace
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Replace ${displayName}`}
        description="Use this if the card is lost or damaged. The new card takes over this card's destination, and the old one stops working immediately."
      >
        <Field
          label="New card code"
          hint="On the back of the replacement card, or in the /t/… link it opens."
          error={error ?? undefined}
        >
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="e.g. 9f3c2a7b1d4e"
            autoComplete="off"
          />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} loading={busy} loadingText="Replacing…">
            Replace card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
