"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Banknote } from "lucide-react";
import { Button, Alert, Field, Input, Select } from "@/components/ui";
import { formatKes } from "@/lib/pricing";
import { OFFLINE_METHODS, OFFLINE_METHOD_LABELS } from "@/lib/payments";
import { recordOfflinePaymentAction, type OpsResult } from "@/app/admin/order-actions";

const initial: OpsResult = {};

function RecordButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} loadingText="Recording…">
      Record payment
    </Button>
  );
}

/**
 * Staff recording money that did not come through M-Pesa.
 *
 * Cash at a meeting, a bank transfer, a Paybill payment made by hand. Without
 * it an offline sale is stuck: `UNPAID_CEILING` refuses to let an unpaid order
 * past `content_received`, so the customer has paid and the workshop cannot
 * start, and no identity is ever provisioned.
 *
 * Deliberately plain and slightly effortful. This is the one control in the
 * console that asserts money exists without a payment processor agreeing, so it
 * asks which method and what reference rather than being a single button, and
 * the row it writes carries who pressed it.
 *
 * Never rendered for a paid order: the honest failure here is recording a
 * payment twice, and the cheapest way to prevent it is to not offer it.
 */
export function RecordPayment({
  orderId,
  orderNumber,
  amountKes,
}: {
  orderId: string;
  orderNumber: string;
  amountKes: number;
}) {
  const [state, action] = useActionState(recordOfflinePaymentAction, initial);

  // Once recorded, the form has done its job and showing it again invites the
  // double entry this is most at risk of.
  if (state.success) {
    return <Alert tone="success">{state.success}</Alert>;
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="flex items-start gap-2">
        <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <p className="text-body-sm text-foreground-secondary">
          Mark {orderNumber} as paid for {formatKes(amountKes)} received outside M-Pesa.
          This provisions the identities exactly as a callback would.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="How was it paid" required className="w-40">
          <Select name="method" required defaultValue="cash">
            {OFFLINE_METHODS.map((m) => (
              <option key={m} value={m}>
                {OFFLINE_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Reference"
          hint="Bank or M-Pesa reference, if there is one."
          className="min-w-[12rem] flex-1"
        >
          <Input name="reference" type="text" placeholder="e.g. SGH4K2L9XZ" maxLength={80} />
        </Field>
        <RecordButton />
      </div>

      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </form>
  );
}
