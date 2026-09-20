"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Truck } from "lucide-react";
import { Button, Alert, Field, Input, Select, Textarea } from "@/components/ui";
import {
  DISPATCH_METHODS,
  DISPATCH_METHOD_META,
  isDispatchMethod,
  type DispatchMethod,
} from "@/lib/orders";
import { dispatchOrderAction, type OpsResult } from "@/app/admin/order-actions";

const initial: OpsResult = {};

function DispatchButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} loadingText="Sending…">
      Mark dispatched
    </Button>
  );
}

/**
 * Handing the parcel over.
 *
 * A form rather than a button, because "dispatched" on its own cannot answer the
 * only question the customer asks next, which is "where is it". The rider's name
 * and number, or a waybill, is the difference between an answer and an apology,
 * and the moment to capture it is while the staff member is still holding the
 * parcel. Ten seconds here saves a phone call that cannot be answered later.
 *
 * The reference field renames itself to whatever the chosen method actually
 * produces. A single "Reference" label invites a rider's phone number in the
 * waybill box and a waybill in the rider box, and then the customer's email
 * carries the wrong kind of fact under the right heading.
 *
 * Not offered unless the order can legally be dispatched: `availableTransitions`
 * decides that on the server and the page passes the answer down, so this is
 * never the thing that lets an unbound or unpaid order go out.
 */
export function DispatchOrder({
  orderId,
  orderNumber,
  destination,
}: {
  orderId: string;
  orderNumber: string;
  /** Where it is going, for the line that confirms what is about to be sent. */
  destination: string | null;
}) {
  const [state, action] = useActionState(dispatchOrderAction, initial);
  const [method, setMethod] = React.useState<DispatchMethod>("rider");

  // Once it has gone out, the form has done its job. Leaving it on screen invites
  // a second dispatch of a parcel that is already with a rider.
  if (state.success) {
    return <Alert tone="success">{state.success}</Alert>;
  }

  const meta = DISPATCH_METHOD_META[method];

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="flex items-start gap-2">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <p className="text-body-sm text-foreground-secondary">
          Send {orderNumber}
          {destination ? ` to ${destination}` : ""}. The customer is emailed the reference
          so they can follow it.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Going out by" required className="w-40">
          <Select
            name="method"
            required
            value={method}
            onChange={(e) => {
              const next = e.target.value;
              if (isDispatchMethod(next)) setMethod(next);
            }}
          >
            {DISPATCH_METHODS.map((m) => (
              <option key={m} value={m}>
                {DISPATCH_METHOD_META[m].label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={meta.referenceLabel}
          hint={meta.referenceHint}
          className="min-w-[16rem] flex-1"
        >
          <Input name="reference" autoComplete="off" />
        </Field>
      </div>

      <Field label="Note" hint="Optional. Added to the order notes, not sent to the customer.">
        <Textarea name="note" rows={2} />
      </Field>

      <div className="flex items-center gap-2">
        <DispatchButton />
      </div>

      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </form>
  );
}
