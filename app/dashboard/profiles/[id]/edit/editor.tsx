"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { BLOCK_DEFS } from "@/lib/blocks";
import type {
  Block,
  BlockType,
  Contact,
  PageConfig,
  Theme,
  ThemePreset,
} from "@/lib/profile";
import { savePageAction } from "./actions";

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
};

let keyCounter = 0;
type UIBlock = Block & { _key: number };

const inputCls = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

export default function Editor(props: Props) {
  const [mode, setMode] = useState<"page" | "redirect">(props.initialMode);
  const [title, setTitle] = useState(props.initialTitle);
  const [redirectUrl, setRedirectUrl] = useState(props.initialRedirectUrl);
  const [bio, setBio] = useState(props.initialConfig.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(props.initialConfig.avatarUrl ?? "");
  const [contact, setContact] = useState<Contact>(
    props.initialConfig.contact ?? {},
  );
  const [accent, setAccent] = useState(props.initialTheme.accent ?? "#111827");
  const [preset, setPreset] = useState<ThemePreset>(
    props.initialTheme.preset ?? "light",
  );
  const [leadEnabled, setLeadEnabled] = useState(
    props.initialConfig.leadForm?.enabled ?? false,
  );
  const [leadHeadline, setLeadHeadline] = useState(
    props.initialConfig.leadForm?.headline ?? "",
  );
  const [leadButton, setLeadButton] = useState(
    props.initialConfig.leadForm?.buttonLabel ?? "",
  );
  const [blocks, setBlocks] = useState<UIBlock[]>(
    (props.initialBlocks ?? []).map((b) => ({ ...b, _key: keyCounter++ })),
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function addBlock() {
    setBlocks((prev) => [
      ...prev,
      { _key: keyCounter++, type: "custom", label: "", value: "", sort_order: prev.length },
    ]);
  }
  function updateBlock(key: number, patch: Partial<UIBlock>) {
    setBlocks((prev) => prev.map((b) => (b._key === key ? { ...b, ...patch } : b)));
  }
  function removeBlock(key: number) {
    setBlocks((prev) => prev.filter((b) => b._key !== key));
  }
  function move(key: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b._key === key);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const supabase = createBrowserSupabase();
      const ext = file.name.split(".").pop() || "png";
      const path = `${props.accountId}/${props.pageId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("page-assets")
        .upload(path, file, { upsert: true });
      if (error) {
        setMsg(error.message);
      } else {
        const { data } = supabase.storage.from("page-assets").getPublicUrl(path);
        setAvatarUrl(data.publicUrl);
      }
    } catch {
      setMsg("Upload failed.");
    }
    setUploading(false);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const config: PageConfig = {
      bio: bio || undefined,
      avatarUrl: avatarUrl || undefined,
      contact,
      leadForm: {
        enabled: leadEnabled,
        headline: leadHeadline || undefined,
        buttonLabel: leadButton || undefined,
      },
    };
    const theme: Theme = { preset, accent };
    const payloadBlocks: Block[] = blocks.map((b, i) => ({
      type: b.type,
      label: b.label,
      value: b.value,
      sort_order: i,
    }));
    const res = await savePageAction(props.pageId, {
      title,
      mode,
      redirectUrl,
      config,
      theme,
      blocks: payloadBlocks,
    });
    setBusy(false);
    setMsg(res.error ?? res.success ?? "Saved.");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Mode */}
      <section className="rounded-xl border border-neutral-200 p-4">
        <h2 className="mb-3 font-semibold">Mode</h2>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "page"}
              onChange={() => setMode("page")}
            />
            Smart page
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "redirect"}
              onChange={() => setMode("redirect")}
            />
            Single redirect
          </label>
        </div>
      </section>

      {mode === "redirect" ? (
        <section className="rounded-xl border border-neutral-200 p-4">
          <h2 className="mb-3 font-semibold">Redirect destination</h2>
          <input
            className={inputCls}
            placeholder="https://g.page/r/… or https://wa.me/2547…"
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
          />
        </section>
      ) : (
        <>
          {/* Profile */}
          <section className="rounded-xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Profile</h2>
            <div className="flex flex-col gap-3">
              <input
                className={inputCls}
                placeholder="Title (e.g. Java House Nairobi)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className={inputCls}
                placeholder="Short bio"
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <div className="flex items-center gap-3">
                {avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                )}
                <input type="file" accept="image/*" onChange={onAvatar} />
                {uploading && <span className="text-sm text-neutral-500">Uploading…</span>}
              </div>
            </div>
          </section>

          {/* Contact (vCard) */}
          <section className="rounded-xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Contact card (vCard)</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ["fullName", "Full name"],
                  ["org", "Organisation"],
                  ["title", "Job title"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                  ["website", "Website"],
                ] as [keyof Contact, string][]
              ).map(([field, label]) => (
                <input
                  key={field}
                  className={inputCls}
                  placeholder={label}
                  value={contact[field] ?? ""}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, [field]: e.target.value }))
                  }
                />
              ))}
            </div>
          </section>

          {/* Theme */}
          <section className="rounded-xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Theme</h2>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                Preset
                <select
                  className="rounded-lg border border-neutral-300 px-2 py-1"
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as ThemePreset)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                Button colour
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                />
              </label>
            </div>
          </section>

          {/* Lead capture */}
          <section className="rounded-xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Lead capture</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={leadEnabled}
                onChange={(e) => setLeadEnabled(e.target.checked)}
              />
              Show a lead form on this page
            </label>
            {leadEnabled && (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  className={inputCls}
                  placeholder="Headline (e.g. Get in touch)"
                  value={leadHeadline}
                  onChange={(e) => setLeadHeadline(e.target.value)}
                />
                <input
                  className={inputCls}
                  placeholder="Button label (default: Send)"
                  value={leadButton}
                  onChange={(e) => setLeadButton(e.target.value)}
                />
              </div>
            )}
          </section>

          {/* Blocks */}
          <section className="rounded-xl border border-neutral-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Action buttons</h2>
              <button
                onClick={addBlock}
                className="rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {blocks.map((b) => (
                <div
                  key={b._key}
                  className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3"
                >
                  <div className="flex gap-2">
                    <select
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      value={b.type}
                      onChange={(e) =>
                        updateBlock(b._key, { type: e.target.value as BlockType })
                      }
                    >
                      {BLOCK_DEFS.map((d) => (
                        <option key={d.type} value={d.type}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto flex gap-1">
                      <button
                        onClick={() => move(b._key, -1)}
                        className="rounded border border-neutral-300 px-2 text-sm"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => move(b._key, 1)}
                        className="rounded border border-neutral-300 px-2 text-sm"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeBlock(b._key)}
                        className="rounded border border-neutral-300 px-2 text-sm text-red-600"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <input
                    className={inputCls}
                    placeholder="Button label"
                    value={b.label}
                    onChange={(e) => updateBlock(b._key, { label: e.target.value })}
                  />
                  {b.type !== "contact" && (
                    <input
                      className={inputCls}
                      placeholder={
                        BLOCK_DEFS.find((d) => d.type === b.type)?.placeholder ?? "Value"
                      }
                      value={b.value}
                      onChange={(e) => updateBlock(b._key, { value: e.target.value })}
                    />
                  )}
                </div>
              ))}
              {blocks.length === 0 && (
                <p className="text-sm text-neutral-500">No buttons yet — add one.</p>
              )}
            </div>
          </section>
        </>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <Link
          href={`${props.siteBase}/${props.slug}`}
          target="_blank"
          className="text-sm text-blue-600 hover:underline"
        >
          View live page ↗
        </Link>
        {msg && <span className="text-sm text-neutral-600">{msg}</span>}
      </div>
    </div>
  );
}
