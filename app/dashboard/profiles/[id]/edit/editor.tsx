"use client";

import * as React from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { ExternalLink, Upload, Palette, Search, Sparkles } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Alert,
  Badge,
  SaveState,
  SwitchField,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
  type SaveStatus,
} from "@/components/ui";
import { EntitlementNotice } from "@/components/billing/entitlement-notice";
import { ActivateDialog } from "@/components/billing/activate-dialog";
import { DraftBanner } from "@/components/profile/draft-banner";
import { isEntitlementError } from "@/lib/entitlement";
import { MobilePreview } from "@/components/builder/mobile-preview";
import { UnsavedChangesGuard } from "@/components/builder/unsaved-changes-guard";
import { BlockPicker } from "@/components/builder/block-picker";
import { SortableAction, type EditorBlock } from "@/components/builder/sortable-action";
import { defaultLabel } from "@/lib/blocks";
import {
  templateOf,
  templateDef,
  TEMPLATE_ORDER,
  TEMPLATES,
  type ProfileTemplate,
} from "@/lib/templates";
import type {
  Block,
  BlockType,
  Contact,
  PageConfig,
  PublicPage,
  Theme,
  ThemePreset,
  PublishStatus,
} from "@/lib/profile";
import { savePageAction, publishPageAction, unpublishPageAction } from "./actions";

type Props = {
  pageId: string;
  accountId: string;
  slug: string;
  siteBase: string;
  initialTitle: string;
  initialMode: "page" | "redirect";
  initialRedirectUrl: string;
  initialConfig: PageConfig;
  initialTheme: Theme;
  initialBlocks: Block[];
  initialStatus: PublishStatus;
  initialPublishedAt: string | null;
  leadCaptureAllowed: boolean;
  /** True when the account HAD a paid plan that has since ended (B13). */
  planLapsed: boolean;
  /** Whether this page may go live at all (D-021). */
  canPublish: boolean;
  /** Why not, in the owner's words. Null when publishing is allowed. */
  publishBlockedReason: string | null;
};

let keyCounter = 0;
const nextKey = () => `b${keyCounter++}`;

export default function Editor(props: Props) {
  const toast = useToast();

  const [mode, setMode] = React.useState(props.initialMode);
  const [title, setTitle] = React.useState(props.initialTitle);
  const [redirectUrl, setRedirectUrl] = React.useState(props.initialRedirectUrl);
  const [config, setConfig] = React.useState<PageConfig>(props.initialConfig);
  const [theme, setTheme] = React.useState<Theme>(props.initialTheme);
  const [blocks, setBlocks] = React.useState<EditorBlock[]>(
    (props.initialBlocks ?? []).map((b) => ({ ...b, key: nextKey() })),
  );
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const template = templateOf(config);
  const tpl = templateDef(template);

  const [status, setStatus] = React.useState<PublishStatus>(props.initialStatus);
  const [publishedAt, setPublishedAt] = React.useState(props.initialPublishedAt);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [dirty, setDirty] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState<"avatar" | "cover" | null>(null);
  const [activateOpen, setActivateOpen] = React.useState(false);

  // Any edit marks the draft ahead of what is saved.
  function touch() {
    setDirty(true);
    setSaveStatus("idle");
  }

  const patchConfig = (patch: Partial<PageConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
    touch();
  };
  const patchTheme = (patch: Partial<Theme>) => {
    setTheme((t) => ({ ...t, ...patch }));
    touch();
  };
  const patchContact = (patch: Partial<Contact>) => {
    setConfig((c) => ({ ...c, contact: { ...c.contact, ...patch } }));
    touch();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Makes reordering fully keyboard-operable (WCAG 2.1.1).
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.key === active.id);
      const to = prev.findIndex((b) => b.key === over.id);
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
    });
    touch();
  }

  function addBlock(type: BlockType) {
    const key = nextKey();
    setBlocks((prev) => [
      ...prev,
      { key, type, label: defaultLabel(type), value: "", sort_order: prev.length, is_active: true },
    ]);
    setExpanded(key);
    touch();
  }

  async function upload(file: File, kind: "avatar" | "cover") {
    setUploading(kind);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const ext = file.name.split(".").pop() || "png";
      const path = `${props.accountId}/${props.pageId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("page-assets")
        .upload(path, file, { upsert: true });
      if (upErr) {
        setError(upErr.message);
      } else {
        const { data } = supabase.storage.from("page-assets").getPublicUrl(path);
        patchConfig(kind === "avatar" ? { avatarUrl: data.publicUrl } : { coverUrl: data.publicUrl });
      }
    } catch {
      setError("Upload failed. Please try again.");
    }
    setUploading(null);
  }

  /** The object the preview renders — identical in shape to the public page. */
  const previewPage: PublicPage = React.useMemo(
    () => ({
      id: props.pageId,
      title,
      mode,
      redirect_url: redirectUrl,
      config,
      theme,
      links: blocks.map((b, i) => ({ ...b, sort_order: i })),
    }),
    [props.pageId, title, mode, redirectUrl, config, theme, blocks],
  );

  async function save(): Promise<boolean> {
    setSaveStatus("saving");
    setError(null);
    const res = await savePageAction(props.pageId, {
      title,
      mode,
      redirectUrl,
      config,
      theme,
      blocks: blocks.map((b, i) => ({
        type: b.type,
        label: b.label,
        value: b.value,
        sort_order: i,
        is_active: b.is_active !== false,
      })),
    });
    if (res.error) {
      setSaveStatus("error");
      setError(res.error);
      return false;
    }
    setSaveStatus("saved");
    setDirty(false);
    window.setTimeout(() => setSaveStatus("idle"), 2000);
    return true;
  }

  async function publish() {
    // The button stays visible and enabled when publishing is not yet possible.
    // Hiding it would hide the goal, and a disabled control explains nothing —
    // pressing it says what activating does instead.
    if (!props.canPublish) {
      setActivateOpen(true);
      return;
    }

    // Publishing an unsaved draft would put the previous version live, which is
    // never what the button appears to promise.
    if (dirty && !(await save())) return;

    const res = await publishPageAction(props.pageId);
    if (res.error) {
      // The server and the database check this independently of the button, so
      // a refusal here is a real state change (an identity lapsed while the tab
      // was open, or a second tab spent the slot) rather than a stale render.
      if (isEntitlementError(res.error)) {
        setActivateOpen(true);
        return;
      }
      setError(res.error);
      return;
    }
    setStatus("published");
    setPublishedAt(res.publishedAt ?? new Date().toISOString());
    toast({
      title: "Page published",
      description: "Anyone tapping your card now sees these changes.",
      tone: "success",
    });
  }

  async function unpublish() {
    const res = await unpublishPageAction(props.pageId);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStatus("draft");
    toast({
      title: "Page unpublished",
      description: "The link now shows a not-found page until you publish again.",
      tone: "warning",
    });
  }

  const liveUrl = `${props.siteBase}/${props.slug}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Covers both leaving the site and navigating within it (UI-0 problem #4). */}
      <UnsavedChangesGuard when={dirty} />

      <ActivateDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        reason={props.publishBlockedReason}
      />

      {/* The single most important thing on this screen for a new customer: what
          they are building is not on the internet yet. Above the status bar,
          because the Draft badge alone was never going to carry that. */}
      {status === "draft" && !props.canPublish && (
        <DraftBanner slug={props.slug} />
      )}

      {/* Status bar */}
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Badge variant={status === "published" ? "success" : "neutral"} dot>
            {status === "published" ? "Live" : "Draft"}
          </Badge>
          {status === "published" && publishedAt && (
            <span className="text-caption text-muted">
              Published {new Date(publishedAt).toLocaleDateString()}
            </span>
          )}
          {dirty && status === "published" && (
            <span className="text-caption text-warning">Unpublished changes</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SaveState status={saveStatus} />
          <Button variant="secondary" size="sm" onClick={save} disabled={!dirty}>
            Save draft
          </Button>
          <Button size="sm" onClick={publish}>
            {status === "published" ? "Publish changes" : "Publish"}
          </Button>
          {status === "published" && (
            <Button variant="ghost" size="sm" onClick={unpublish}>
              Unpublish
            </Button>
          )}
          {/* Only offered when there is something at the other end. A draft's
              slug does not resolve, so this would have opened a 404 in a new
              tab and looked like a broken product rather than an unpublished
              page. The preview beside the editor is the draft's viewer. */}
          {status === "published" && (
            <Link
              href={liveUrl}
              target="_blank"
              className="inline-flex items-center gap-1 text-caption text-primary-strong hover:underline"
            >
              View live
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Editing surface */}
        <div className="flex flex-col gap-4">
          <Card padding="sm">
            <Tabs value={mode} onValueChange={(v) => { setMode(v as "page" | "redirect"); touch(); }}>
              <TabsList aria-label="Page type">
                <TabsTrigger value="page">Smart page</TabsTrigger>
                <TabsTrigger value="redirect">Single redirect</TabsTrigger>
              </TabsList>

              <TabsContent value="redirect">
                <Field
                  label="Redirect destination"
                  hint="Every tap goes straight here. Nothing else is shown."
                >
                  <Input
                    value={redirectUrl}
                    onChange={(e) => { setRedirectUrl(e.target.value); touch(); }}
                    placeholder="https://g.page/r/… or https://wa.me/2547…"
                    inputMode="url"
                  />
                </Field>
              </TabsContent>

              <TabsContent value="page">
                <p className="text-caption text-muted">
                  Build a page with your details and action buttons below.
                </p>
              </TabsContent>
            </Tabs>
          </Card>

          {mode === "page" && (
            <>
              <Card padding="md">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-section-title text-foreground">{tpl.identityHeading}</h2>
                  <label className="flex items-center gap-2 text-caption text-muted">
                    Template
                    <select
                      value={template}
                      onChange={(e) => {
                        patchConfig({ template: e.target.value as ProfileTemplate });
                      }}
                      className="h-8 rounded-lg border border-border-strong bg-surface px-2 text-body-sm text-foreground"
                    >
                      {TEMPLATE_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {TEMPLATES[id].label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-col gap-4">
                  <Field label={template === "card" ? "Your name" : "Business name"}>
                    <Input
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); touch(); }}
                      placeholder={tpl.namePlaceholder}
                    />
                  </Field>
                  {/* A card derives its line from the vCard title/company, so
                      offering a separate tagline would create two sources of
                      truth for the same statement. */}
                  {template !== "card" && (
                    <Field label="Tagline" hint="One short line under your name">
                      <Input
                        value={config.tagline ?? ""}
                        onChange={(e) => patchConfig({ tagline: e.target.value })}
                        placeholder="Coffee shop · Westlands"
                      />
                    </Field>
                  )}
                  <Field label="About">
                    <Textarea
                      value={config.bio ?? ""}
                      onChange={(e) => patchConfig({ bio: e.target.value })}
                      rows={2}
                      placeholder="What you do, in a sentence."
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <ImageField
                      label={template === "card" ? "Photo" : "Logo"}
                      url={config.avatarUrl}
                      busy={uploading === "avatar"}
                      onPick={(f) => upload(f, "avatar")}
                      onClear={() => patchConfig({ avatarUrl: undefined })}
                    />
                    <ImageField
                      label="Cover image"
                      url={config.coverUrl}
                      busy={uploading === "cover"}
                      onPick={(f) => upload(f, "cover")}
                      onClear={() => patchConfig({ coverUrl: undefined })}
                    />
                  </div>

                  {/* On a card the contact details ARE the content, so they sit
                      here rather than behind the Advanced disclosure. */}
                  {tpl.contactFirst && (
                    <div className="border-t border-border pt-4">
                      <h3 className="mb-3 text-card-title text-foreground">
                        Contact card (vCard)
                      </h3>
                      <ContactFields contact={config.contact} onChange={patchContact} />
                    </div>
                  )}
                </div>
              </Card>

              <Card padding="md">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-section-title text-foreground">Actions</h2>
                    <p className="text-caption text-muted">
                      Drag to reorder. The first action is the main button.
                    </p>
                  </div>
                  <BlockPicker onAdd={addBlock} />
                </div>

                {blocks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-body-sm text-muted">
                    No actions yet — add WhatsApp or a Google review link to start.
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  >
                    <SortableContext
                      items={blocks.map((b) => b.key)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="flex flex-col gap-2">
                        {blocks.map((block) => (
                          <SortableAction
                            key={block.key}
                            block={block}
                            expanded={expanded === block.key}
                            onToggleExpanded={() =>
                              setExpanded((k) => (k === block.key ? null : block.key))
                            }
                            onChange={(patch) => {
                              setBlocks((prev) =>
                                prev.map((b) => (b.key === block.key ? { ...b, ...patch } : b)),
                              );
                              touch();
                            }}
                            onRemove={() => {
                              setBlocks((prev) => prev.filter((b) => b.key !== block.key));
                              touch();
                            }}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
              </Card>

              {/* Advanced — collapsed so Simple Mode stays simple (§12). */}
              <details className="group rounded-xl border border-border bg-surface">
                <summary className="flex cursor-pointer items-center gap-2 p-4 text-section-title text-foreground [&::-webkit-details-marker]:hidden">
                  <Sparkles className="h-4 w-4 text-muted" aria-hidden="true" />
                  Advanced
                  <span className="ml-auto text-caption font-normal text-muted">
                    Contact card, theme, lead form, SEO
                  </span>
                </summary>

                <div className="flex flex-col gap-5 border-t border-border p-4">
                  {!tpl.contactFirst && (
                    <section>
                      <h3 className="mb-3 text-card-title text-foreground">
                        Contact card (vCard)
                      </h3>
                      <ContactFields contact={config.contact} onChange={patchContact} />
                    </section>
                  )}

                  <section>
                    <h3 className="mb-3 flex items-center gap-1.5 text-card-title text-foreground">
                      <Palette className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                      Theme
                    </h3>
                    <div className="flex flex-wrap items-center gap-4">
                      <Field label="Style">
                        <select
                          value={theme.preset ?? "light"}
                          onChange={(e) => patchTheme({ preset: e.target.value as ThemePreset })}
                          className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-body-sm"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </Field>
                      <Field label="Button colour">
                        <input
                          type="color"
                          value={theme.accent ?? "#111827"}
                          onChange={(e) => patchTheme({ accent: e.target.value })}
                          className="h-10 w-16 cursor-pointer rounded-lg border border-border-strong bg-surface p-1"
                        />
                      </Field>
                    </div>
                    <p className="mt-2 text-caption text-muted">
                      Button text switches between dark and light automatically to stay readable.
                    </p>
                  </section>

                  <section>
                    <h3 className="mb-3 text-card-title text-foreground">Lead capture</h3>
                    {props.leadCaptureAllowed ? (
                      <div className="flex flex-col gap-3">
                        <SwitchField
                          label="Show a lead form"
                          description="Collect name, phone and email from visitors."
                          checked={config.leadForm?.enabled ?? false}
                          onCheckedChange={(v) =>
                            patchConfig({ leadForm: { ...config.leadForm, enabled: v } })
                          }
                        />
                        {config.leadForm?.enabled && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Headline">
                              <Input
                                value={config.leadForm?.headline ?? ""}
                                onChange={(e) =>
                                  patchConfig({
                                    leadForm: { ...config.leadForm, headline: e.target.value },
                                  })
                                }
                                placeholder="Get in touch"
                              />
                            </Field>
                            <Field label="Button label">
                              <Input
                                value={config.leadForm?.buttonLabel ?? ""}
                                onChange={(e) =>
                                  patchConfig({
                                    leadForm: { ...config.leadForm, buttonLabel: e.target.value },
                                  })
                                }
                                placeholder="Send"
                              />
                            </Field>
                          </div>
                        )}
                      </div>
                    ) : props.planLapsed ? (
                      // A lapsed plan is a different problem from never having
                      // had one, and "upgrade to Pro" is confusing advice for
                      // someone who already bought Pro.
                      <EntitlementNotice feature="Lead capture" />
                    ) : (
                      <Alert tone="info">
                        Lead capture is available on the Pro plan.{" "}
                        <Link href="/dashboard/billing" className="underline">
                          See plans
                        </Link>
                      </Alert>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-3 flex items-center gap-1.5 text-card-title text-foreground">
                      <Search className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                      Search &amp; sharing
                    </h3>
                    <div className="flex flex-col gap-3">
                      <Field label="Page title" hint="Shown in search results and when shared">
                        <Input
                          value={config.seo?.title ?? ""}
                          onChange={(e) =>
                            patchConfig({ seo: { ...config.seo, title: e.target.value } })
                          }
                          placeholder={title || "Your business name"}
                        />
                      </Field>
                      <Field label="Description">
                        <Textarea
                          rows={2}
                          value={config.seo?.description ?? ""}
                          onChange={(e) =>
                            patchConfig({ seo: { ...config.seo, description: e.target.value } })
                          }
                          placeholder="A sentence describing your business."
                        />
                      </Field>
                    </div>
                  </section>
                </div>
              </details>
            </>
          )}
        </div>

        {/* Preview */}
        {mode === "page" ? (
          <MobilePreview page={previewPage} dirty={dirty} className="lg:sticky lg:top-20" />
        ) : (
          <Card padding="md" className="lg:sticky lg:top-20">
            <h2 className="mb-2 text-card-title text-foreground">Redirect</h2>
            <p className="text-body-sm text-muted">
              Every tap on <span className="text-foreground">/{props.slug}</span> goes straight to
              your destination — there is no page to preview.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

const CONTACT_FIELDS: [keyof Contact, string][] = [
  ["fullName", "Full name"],
  ["org", "Organisation"],
  ["title", "Job title"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["website", "Website"],
];

/** Shared so the card and business layouts cannot drift apart. */
function ContactFields({
  contact,
  onChange,
}: {
  contact?: Contact;
  onChange: (patch: Partial<Contact>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CONTACT_FIELDS.map(([field, label]) => (
        <Field key={field} label={label}>
          <Input
            value={contact?.[field] ?? ""}
            onChange={(e) => onChange({ [field]: e.target.value })}
          />
        </Field>
      ))}
    </div>
  );
}

function ImageField({
  label,
  url,
  busy,
  onPick,
  onClear,
}: {
  label: string;
  url?: string;
  busy: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputId = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border-strong text-muted">
            <Upload className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="flex flex-col gap-1">
          <label
            htmlFor={inputId}
            className="cursor-pointer text-caption font-medium text-primary-strong hover:underline"
          >
            {busy ? "Uploading…" : url ? "Replace" : "Upload"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(file);
              e.target.value = "";
            }}
          />
          {url && (
            <button
              type="button"
              onClick={onClear}
              className="text-left text-caption text-muted hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
