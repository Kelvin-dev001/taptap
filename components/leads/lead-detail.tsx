"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageCircle, Mail, Trash2, History } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  Button,
  Field,
  Textarea,
  Alert,
  Badge,
  SaveState,
  ConfirmDialog,
  useToast,
  type SaveStatus,
} from "@/components/ui";
import { StatusBadge } from "./status-badge";
import {
  LEAD_STATUSES,
  STATUS_META,
  contactChannels,
  leadDisplayName,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";
import { relativeTime } from "@/lib/metrics";
import { updateLeadAction, deleteLeadAction } from "@/app/dashboard/customers/actions";
import { cn } from "@/lib/cn";

const CHANNEL_ICONS = { call: Phone, whatsapp: MessageCircle, email: Mail };

/**
 * Working view for a single enquiry: reach out, record what happened, move it
 * along. The submitted details are shown read-only — they are the record of
 * what a customer sent, not editable content (see migration 0012).
 *
 * Callers must pass `key={lead.id}` so switching leads remounts this and the
 * draft note resets. Copying the prop into state inside an effect would render
 * one frame showing the previous lead's note.
 */
export function LeadDetail({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = React.useState(lead.note ?? "");
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const name = leadDisplayName(lead);
  const channels = contactChannels(lead);

  async function setStatus(status: LeadStatus) {
    setError(null);
    const res = await updateLeadAction(lead.id, { status });
    if (res.error) {
      setError(res.error);
      return;
    }
    toast({ title: `Marked ${STATUS_META[status].label.toLowerCase()}`, tone: "success" });
    router.refresh();
  }

  async function saveNote() {
    setSaveStatus("saving");
    setError(null);
    const res = await updateLeadAction(lead.id, { note });
    if (res.error) {
      setSaveStatus("error");
      setError(res.error);
      return;
    }
    setSaveStatus("saved");
    window.setTimeout(() => setSaveStatus("idle"), 2000);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await deleteLeadAction(lead.id);
    setBusy(false);
    setConfirmDelete(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onOpenChange(false);
    toast({ title: "Lead deleted", tone: "success" });
    router.refresh();
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent side="right" title={name} description={`From ${lead.page_title || `/${lead.page_slug}`}`}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              <span className="text-caption text-muted">
                Received {relativeTime(lead.created_at)}
              </span>
              {lead.repeat_count > 0 && (
                <Badge variant="brand">
                  <History className="h-3 w-3" aria-hidden="true" />
                  {lead.repeat_count} previous{" "}
                  {lead.repeat_count === 1 ? "enquiry" : "enquiries"}
                </Badge>
              )}
            </div>

            {/* Reach out */}
            {channels.length > 0 ? (
              <section>
                <h3 className="mb-2 text-card-title text-foreground">Get in touch</h3>
                <div className="flex flex-wrap gap-2">
                  {channels.map((c) => {
                    const Icon = CHANNEL_ICONS[c.kind];
                    return (
                      <Button key={c.kind} asChild variant="secondary" size="sm">
                        <a
                          href={c.href}
                          target={c.kind === "whatsapp" ? "_blank" : undefined}
                          rel={c.kind === "whatsapp" ? "noopener noreferrer" : undefined}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {c.label}
                        </a>
                      </Button>
                    );
                  })}
                </div>
              </section>
            ) : (
              <Alert tone="warning">
                This enquiry left no phone or email, so there is no way to reply.
              </Alert>
            )}

            {/* What they sent — read only on purpose */}
            <section>
              <h3 className="mb-2 text-card-title text-foreground">What they sent</h3>
              <dl className="flex flex-col divide-y divide-border rounded-lg border border-border">
                <Row label="Name" value={lead.name} />
                <Row label="Phone" value={lead.phone} />
                <Row label="Email" value={lead.email} />
                <Row label="Company" value={lead.company} />
                <Row label="Message" value={lead.message} />
              </dl>
              <p className="mt-2 text-caption text-muted">
                These are the customer&rsquo;s own words and cannot be edited.
              </p>
            </section>

            {/* Move it along */}
            <section>
              <h3 className="mb-2 text-card-title text-foreground">Status</h3>
              <div className="flex flex-wrap gap-1.5">
                {LEAD_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    aria-pressed={lead.status === s}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-body-sm transition-colors duration-fast",
                      lead.status === s
                        ? "border-primary bg-primary-soft font-medium text-primary-strong"
                        : "border-border text-foreground-secondary hover:bg-surface-sunken",
                    )}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-caption text-muted">
                {STATUS_META[lead.status].description}
              </p>
            </section>

            {/* Private note */}
            <section>
              <Field label="Your notes" hint="Only you can see this. The customer never does.">
                <Textarea
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Called back Tuesday — wants a quote for 50 cards."
                  maxLength={2000}
                />
              </Field>
              <div className="mt-2 flex items-center gap-3">
                <Button size="sm" onClick={saveNote} disabled={note === (lead.note ?? "")}>
                  Save note
                </Button>
                <SaveState status={saveStatus} />
              </div>
            </section>

            {error && <Alert tone="danger">{error}</Alert>}

            <section className="border-t border-border pt-4">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete this lead
              </Button>
              <p className="mt-1 text-caption text-muted">
                Use this to honour a request to erase someone&rsquo;s details.
              </p>
            </section>
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${name}?`}
        description="This permanently removes the enquiry and everything the customer sent. It cannot be undone."
        confirmLabel="Delete lead"
        destructive
        loading={busy}
        onConfirm={remove}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <dt className="w-20 shrink-0 text-caption text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-body-sm text-foreground">
        {value?.trim() || <span className="text-muted">—</span>}
      </dd>
    </div>
  );
}
