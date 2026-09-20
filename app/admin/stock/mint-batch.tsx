"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input, Select, Textarea, Alert } from "@/components/ui";
import { MAX_BATCH_QUANTITY } from "@/lib/stock";
import { mintBatchAction, type StockResult } from "../stock-actions";

const initial: StockResult = {};

function MintButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText="Minting…">
      Mint batch
    </Button>
  );
}

/**
 * Minting a print run.
 *
 * `ADMIN_TOKEN` stays as a second factor (D-020). The staff gate on the layout
 * is who you are; this is confirmation for the one action in the console that
 * creates permanent public identifiers — tokens that get printed onto plastic
 * and locked onto chips, where they stay for the life of the card.
 */
export function MintBatch() {
  const [state, action] = useActionState(mintBatchAction, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Field label="Which card" required className="min-w-[10rem] flex-1">
          <Select name="variant" required defaultValue="standard">
            <option value="standard">Standard</option>
            <option value="premium">Premium blank</option>
          </Select>
        </Field>

        <Field label="How many" required hint={`Up to ${MAX_BATCH_QUANTITY}`} className="w-32">
          <Input
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_BATCH_QUANTITY}
            defaultValue={100}
            required
          />
        </Field>
      </div>

      <Field label="Supplier" hint="Who is printing this run">
        <Input name="supplier" autoComplete="off" />
      </Field>

      <Field label="Notes" hint="Anything worth remembering when the box arrives">
        <Textarea name="notes" rows={2} />
      </Field>

      <Field
        label="Admin key"
        required
        hint="Confirms a permanent action. Not your password."
      >
        <Input name="key" type="password" required autoComplete="off" />
      </Field>

      <MintButton />

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
    </form>
  );
}
