"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MapPin, Truck, Pencil } from "lucide-react";
import { Button, Alert, Field, Input, Textarea } from "@/components/ui";
import { DISPATCH_METHOD_META, isDispatchMethod } from "@/lib/orders";
import { updateDeliveryAction, type DeliveryResult } from "./actions";

const initial: DeliveryResult = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} loadingText="Saving…">
      Save details
    </Button>
  );
}

export type DeliveryView = {
  orderId: string;
  contactName: string | null;
  contactPhone: string | null;
  town: string | null;
  area: string | null;
  notes: string | null;
  zoneLabel: string | null;
  dispatchMethod: string | null;
  dispatchReference: string | null;
  dispatchedAt: string | null;
  /** False once the parcel has left: the details are then a record, not a form. */
  editable: boolean;
};

/**
 * Where the customer's parcel is going, and where it has got to.
 *
 * Read-only until they ask to change something. An address they have already
 * given, sitting in open input boxes on every visit, reads as a form left
 * unfinished and invites an accidental edit; the same fields behind one "Change
 * these" button read as a record they can correct.
 *
 * Once it is dispatched the form is gone entirely and the reference takes its
 * place, because at that point the useful thing is not the address we have but
 * the number of the person holding the box. `update_order_delivery` refuses a
 * dispatched order anyway, so this is the honest shape of a rule the database
 * already enforces rather than a second copy of it.
 */
export function DeliveryDetails({ delivery }: { delivery: DeliveryView }) {
  const [state, action] = useActionState(updateDeliveryAction, initial);
  const [editing, setEditing] = React.useState(false);

  // Close the form once the save lands. Adjusted during render rather than in an
  // effect: this is React's documented way to react to a changed value, it
  // renders once instead of twice, and an effect calling setState here is the
  // cascading-render pattern the lint rule objects to elsewhere in this console.
  const [seenSuccess, setSeenSuccess] = React.useState(state.success);
  if (state.success !== seenSuccess) {
    setSeenSuccess(state.success);
    if (state.success) setEditing(false);
  }

  const where =
    [delivery.area, delivery.town].filter((v) => v?.trim()).join(", ") ||
    delivery.zoneLabel ||
    null;

  // Sent: the address stops being the interesting fact.
  if (delivery.dispatchedAt) {
    const method = isDispatchMethod(delivery.dispatchMethod)
      ? DISPATCH_METHOD_META[delivery.dispatchMethod]
      : null;
    return (
      <div className="flex items-start gap-2 rounded-lg bg-surface-sunken px-3 py-2">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0 text-body-sm">
          <p className="text-foreground">
            Sent {method ? method.customerNoun : "to you"}
            {where ? ` to ${where}` : ""} on{" "}
            {new Date(delivery.dispatchedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </p>
          {delivery.dispatchReference ? (
            <p className="text-foreground-secondary">
              {method ? method.referenceLabel : "Reference"}:{" "}
              <span className="font-medium text-foreground">{delivery.dispatchReference}</span>
            </p>
          ) : (
            <p className="text-muted">We will send you the tracking details shortly.</p>
          )}
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <div className="min-w-0 text-body-sm">
            <p className="text-foreground">{where ?? "No address yet"}</p>
            <p className="text-foreground-secondary">
              {[delivery.contactName, delivery.contactPhone].filter(Boolean).join(" · ") ||
                "No contact given"}
            </p>
          </div>
        </div>
        {delivery.editable && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Change these
          </Button>
        )}
        {state.success && <Alert tone="success">{state.success}</Alert>}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={delivery.orderId} />

      <p className="text-body-sm text-muted">
        You can correct these until the parcel leaves us. The town decides the delivery fee,
        so moving further afield is a phone call rather than a field.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Who should we ask for" required>
          <Input name="contactName" defaultValue={delivery.contactName ?? ""} required />
        </Field>
        <Field label="Phone" required>
          <Input
            name="contactPhone"
            type="tel"
            inputMode="tel"
            defaultValue={delivery.contactPhone ?? ""}
            required
          />
        </Field>
        <Field label="Town">
          <Input name="deliveryTown" defaultValue={delivery.town ?? ""} />
        </Field>
        <Field label="Area or landmark" hint="Whatever helps the rider find you.">
          <Input name="deliveryArea" defaultValue={delivery.area ?? ""} />
        </Field>
      </div>

      <Field label="Anything else" hint="Optional. Gate colour, floor, best time to call.">
        <Textarea name="deliveryNotes" rows={2} defaultValue={delivery.notes ?? ""} />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <SaveButton />
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
    </form>
  );
}
