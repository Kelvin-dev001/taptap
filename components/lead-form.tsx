"use client";

import { useState } from "react";
import type { LeadFormConfig } from "@/lib/profile";

const inputCls =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900";

export default function LeadForm({
  pageId,
  config,
  accent,
}: {
  pageId: string;
  config: LeadFormConfig;
  accent: string;
}) {
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
      setError("Add your name, phone, or email.");
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
      <p className="text-center text-sm opacity-80">
        Thanks — we’ll be in touch.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2">
      {config.headline && (
        <p className="text-center text-sm font-medium">{config.headline}</p>
      )}
      <input
        className={inputCls}
        placeholder="Name"
        value={form.name}
        onChange={(e) => upd("name", e.target.value)}
      />
      <input
        className={inputCls}
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => upd("phone", e.target.value)}
      />
      <input
        className={inputCls}
        placeholder="Email"
        value={form.email}
        onChange={(e) => upd("email", e.target.value)}
      />
      <input
        className={inputCls}
        placeholder="Company (optional)"
        value={form.company}
        onChange={(e) => upd("company", e.target.value)}
      />
      <textarea
        className={inputCls}
        placeholder="Message (optional)"
        rows={2}
        value={form.message}
        onChange={(e) => upd("message", e.target.value)}
      />
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
        style={{ backgroundColor: accent }}
        className="rounded-xl px-5 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {busy ? "Sending…" : config.buttonLabel || "Send"}
      </button>
      {error && <p className="text-center text-xs text-red-500">{error}</p>}
      <p className="text-center text-[10px] opacity-60">
        By submitting you consent to be contacted.
      </p>
    </form>
  );
}
