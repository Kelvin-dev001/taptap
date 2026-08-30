"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Nfc, CreditCard } from "lucide-react";
import { Card, Badge, Button, Field, Input, Alert, Checkbox, EmptyState } from "@/components/ui";
import {
  identityState,
  renewalAmountKes,
  IDENTITY_STATE_META,
  type IdentityRow,
} from "@/lib/identity";
import { formatKes, DEVICE_LABELS, type DeviceKind } from "@/lib/pricing";
import { startRenewalAction, type CheckoutResult } from "@/app/dashboard/billing/actions";

const initial: CheckoutResult = {};

function RenewButton({ amount, count }: { amount: number; count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText="Starting…" disabled={count === 0}>
      {count === 0 ? "Select a device" : `Renew ${count} · ${formatKes(amount)}`}
    </Button>
  );
}

/**
 * The account's devices, each with its own term, and one payment that renews
 * whichever are selected.
 *
 * Pre-selecting what is due (and what has already lapsed) makes the common case
 * one tap, while still letting an owner pay for a single card early. The total
 * is always `count × price` — the arithmetic is visible rather than implied,
 * because an M-Pesa prompt for an amount the customer did not expect is where
 * trust in a payment flow is lost.
 */
export function IdentityList({
  identities,
  dueIds,
}: {
  identities: IdentityRow[];
  /** Devices due within the batch window — pre-selected on first render. */
  dueIds: string[];
}) {
  const [state, action] = useActionState(startRenewalAction, initial);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(dueIds));

  const billable = identities.filter((t) => {
    const s = identityState(t);
    return s !== "unclaimed" && s !== "disabled";
  });

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  if (identities.length === 0) {
    return (
      <Card padding="md">
        <h2 className="mb-4 text-section-title text-foreground">Your devices</h2>
        <EmptyState
          icon={Nfc}
          title="No cards or stands yet"
          description="Buy a Smart Card or Smart Stand and it appears here with its own renewal date. The price includes the first twelve months."
        />
      </Card>
    );
  }

  const amount = renewalAmountKes(selected.size);

  return (
    <Card padding="md">
      <h2 className="mb-1 text-section-title text-foreground">Your devices</h2>
      <p className="mb-4 text-body-sm text-muted">
        Each device carries its own twelve-month term. Renew any of them together in one
        M-Pesa payment.
      </p>

      <form action={action} className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y divide-border">
          {identities.map((tag) => {
            const state = identityState(tag);
            const meta = IDENTITY_STATE_META[state];
            const kind = (tag.kind as DeviceKind) ?? "card";
            const canRenew = billable.some((b) => b.id === tag.id);
            const ends = tag.term_end
              ? new Date(tag.term_end).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : null;

            return (
              <li
                key={tag.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {canRenew ? (
                    <Checkbox
                      name="tag"
                      value={tag.id}
                      checked={selected.has(tag.id)}
                      onCheckedChange={(v) => toggle(tag.id, v === true)}
                      className="mt-1"
                      aria-label={`Renew ${tag.label || DEVICE_LABELS[kind]}`}
                    />
                  ) : (
                    <span className="mt-0.5 w-[18px]" aria-hidden="true" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
                      <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                      {tag.label || DEVICE_LABELS[kind]}
                    </span>
                    <span className="text-caption text-muted">
                      {DEVICE_LABELS[kind]}
                      {ends ? ` · ${state === "expired" ? "ended" : "renews"} ${ends}` : ""}
                    </span>
                    <span className="text-caption text-muted">{meta.description}</span>
                  </div>
                </div>

                <Badge variant={meta.tone} dot>
                  {meta.label}
                </Badge>
              </li>
            );
          })}
        </ul>

        {billable.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <Field label="M-Pesa number" required className="min-w-[12rem] flex-1">
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                required
                placeholder="0712 345 678"
              />
            </Field>
            <RenewButton amount={amount} count={selected.size} />
          </div>
        )}

        {state.error && <Alert tone="danger">{state.error}</Alert>}
        {state.success && <Alert tone="success">{state.success}</Alert>}
      </form>
    </Card>
  );
}
