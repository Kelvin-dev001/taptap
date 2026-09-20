"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input, Alert } from "@/components/ui";
import { receiveBatchAction, markDefectiveAction, type StockResult } from "../stock-actions";

const initial: StockResult = {};

function SubmitButton({
  label,
  busyLabel,
  variant = "secondary",
  size = "sm",
}: {
  label: string;
  busyLabel: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} variant={variant} loading={pending} loadingText={busyLabel}>
      {label}
    </Button>
  );
}

/** The box arrived. The chips are still blank, so this does not make them sellable. */
export function ReceiveBatch({ batchId }: { batchId: string }) {
  const [state, action] = useActionState(receiveBatchAction, initial);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="batchId" value={batchId} />
      <SubmitButton label="Mark received" busyLabel="Saving…" />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </form>
  );
}

/**
 * Writing a card off.
 *
 * By serial rather than by picking from a list: the person doing this is holding
 * the card and reading the number off the back, which is faster than finding it
 * among several hundred identical rows.
 */
export function MarkDefective() {
  const [state, action] = useActionState(markDefectiveAction, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Serial" required hint="Printed under the QR on the back">
        <Input name="serial" placeholder="S-000123" autoComplete="off" spellCheck={false} required />
      </Field>

      <Field label="What is wrong with it" required>
        <Input name="reason" placeholder="Chip does not read" autoComplete="off" required />
      </Field>

      <SubmitButton label="Write it off" busyLabel="Saving…" variant="danger" />

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
    </form>
  );
}
