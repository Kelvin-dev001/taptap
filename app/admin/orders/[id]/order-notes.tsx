"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card, Button, Textarea, Alert } from "@/components/ui";
import { saveOrderNotesAction, type OpsResult } from "@/app/admin/order-actions";

const initial: OpsResult = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} loadingText="Saving…">
      Save note
    </Button>
  );
}

/**
 * Free-text notes on an order.
 *
 * Deliberately unstructured: this is where "customer wants the logo bigger" and
 * "courier could not find the office" go, and no set of fields anticipates
 * those. The status timeline records what happened; this records why.
 */
export function OrderNotes({ orderId, notes }: { orderId: string; notes: string | null }) {
  const [state, action] = useActionState(saveOrderNotesAction, initial);

  return (
    <Card padding="md">
      <h2 className="mb-3 text-section-title text-foreground">Notes</h2>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="orderId" value={orderId} />
        <Textarea
          name="notes"
          rows={5}
          defaultValue={notes ?? ""}
          placeholder="Anything the next person needs to know."
          aria-label="Order notes"
        />
        <div>
          <SaveButton />
        </div>
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        {state.success && <Alert tone="success">{state.success}</Alert>}
      </form>
    </Card>
  );
}
