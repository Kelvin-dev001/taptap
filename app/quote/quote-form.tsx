"use client";

import * as React from "react";
import { CircleCheck } from "lucide-react";
import { Card, Button, Field, Input, Textarea, Alert } from "@/components/ui";

/**
 * The sales-led door.
 *
 * A business kitting out thirty people should not be pushed through a checkout
 * that caps at twenty and asks for one M-Pesa number. What they actually need is
 * a quote, an invoice and someone to talk to, and asking them to self-serve is
 * how that sale gets lost.
 *
 * Five fields, four of them optional. The point is to start a conversation, not
 * to qualify a lead: every extra required field on this form is a company that
 * closes the tab.
 */
export function QuoteForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        company: form.get("company"),
        email: form.get("email"),
        phone: form.get("phone"),
        quantity: form.get("quantity"),
        notes: form.get("notes"),
        website2: form.get("website2"),
      }),
    }).catch(() => null);

    setBusy(false);

    if (!res || !res.ok) {
      setError(
        "That did not send. Try again, or message us on WhatsApp and we will pick it up there.",
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Card padding="md" className="flex flex-col gap-3">
        <CircleCheck className="h-6 w-6 text-success" aria-hidden="true" />
        <h2 className="text-section-title text-foreground">We have got it</h2>
        <p className="text-body-sm text-foreground-secondary">
          One of us will come back to you with a quote, usually within one working day. If it
          is urgent, message us on WhatsApp and mention that you have sent this form.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" required>
            <Input name="name" required autoComplete="name" />
          </Field>
          <Field label="Company">
            <Input name="company" autoComplete="organization" />
          </Field>
          <Field label="Email" hint="Email or phone, whichever suits you.">
            <Input name="email" type="email" autoComplete="email" defaultValue={defaultEmail} />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" />
          </Field>
        </div>

        <Field label="Roughly how many cards" hint="An estimate is fine. We can refine it.">
          <Input name="quantity" type="number" inputMode="numeric" min={1} className="sm:w-40" />
        </Field>

        <Field label="Anything we should know">
          <Textarea
            name="notes"
            rows={4}
            placeholder="Who they are for, when you need them, whether you need an invoice first."
          />
        </Field>

        {/* Honeypot. Hidden from people, irresistible to bots. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website2">Website</label>
          <input id="website2" name="website2" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" loading={busy} loadingText="Sending…" className="self-start">
          Ask for a quote
        </Button>
      </form>
    </Card>
  );
}
