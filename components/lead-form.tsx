"use client";

import { useId, useState } from "react";
import type { LeadFormConfig } from "@/lib/profile";
import { onAccentColor } from "@/lib/profile";

/**
 * The public lead form.
 *
 * Closes UI-0 finding A3 — the last placeholder-as-label form in the product,
 * and the only one a *customer* ever fills in. Placeholders vanish the moment
 * someone types, so a screen-reader user reviewing their answers had no way to
 * tell which field was which.
 *
 * Styled from the business's own theme rather than the design system: this
 * renders inside their page, so it has to obey their accent, not ours. The
 * label colour is computed for contrast the same way action buttons are.
 */
export default function LeadForm({
  pageId,
  config,
  accent,
}: {
  pageId: string;
  config: LeadFormConfig;
  accent: string;
}) {
  const uid = useId();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    message: "",
    website2: "", // honeypot
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upd(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name && !form.phone && !form.email) {
      setError("Add your name, phone, or email so we can reply.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId, ...form }),
      });
      if (!res.ok) {
        setError("Could not send. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Could not send. Please try again.");
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <p role="status" className="text-center text-sm opacity-80">
        Thanks — we&rsquo;ll be in touch.
      </p>
    );
  }

  const fields = [
    { key: "name", label: "Name", type: "text", autoComplete: "name", inputMode: undefined },
    { key: "phone", label: "Phone", type: "tel", autoComplete: "tel", inputMode: "tel" as const },
    { key: "email", label: "Email", type: "email", autoComplete: "email", inputMode: "email" as const },
    { key: "company", label: "Company (optional)", type: "text", autoComplete: "organization", inputMode: undefined },
  ] as const;

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2.5">
      {config.headline && (
        <p className="text-center text-sm font-medium">{config.headline}</p>
      )}

      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label htmlFor={`${uid}-${f.key}`} className="text-xs opacity-70">
            {f.label}
          </label>
          <input
            id={`${uid}-${f.key}`}
            name={f.key}
            type={f.type}
            inputMode={f.inputMode}
            autoComplete={f.autoComplete}
            className="rounded-lg border border-current/20 bg-white/5 px-3 py-2 text-sm"
            value={form[f.key]}
            onChange={(e) => upd(f.key, e.target.value)}
            aria-describedby={error ? `${uid}-error` : undefined}
          />
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-message`} className="text-xs opacity-70">
          Message (optional)
        </label>
        <textarea
          id={`${uid}-message`}
          name="message"
          rows={2}
          className="rounded-lg border border-current/20 bg-white/5 px-3 py-2 text-sm"
          value={form.message}
          onChange={(e) => upd("message", e.target.value)}
        />
      </div>

      {/* honeypot — hidden from humans, bots fill it */}
      <input
        type="text"
        name="website2"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={form.website2}
        onChange={(e) => upd("website2", e.target.value)}
      />

      <button
        type="submit"
        disabled={busy}
        style={{ backgroundColor: accent, color: onAccentColor(accent) }}
        className="mt-1 rounded-xl px-5 py-2.5 font-medium disabled:opacity-50"
      >
        {busy ? "Sending…" : config.buttonLabel || "Send"}
      </button>

      {error && (
        <p id={`${uid}-error`} role="alert" className="text-center text-xs font-medium">
          {error}
        </p>
      )}

      <p className="text-center text-[11px] opacity-70">
        By submitting you consent to be contacted.
      </p>
    </form>
  );
}
