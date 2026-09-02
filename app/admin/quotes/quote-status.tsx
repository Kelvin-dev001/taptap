"use client";

import { useActionState } from "react";
import { Select } from "@/components/ui";
import { QUOTE_STATUSES, QUOTE_STATUS_LABELS } from "@/lib/quotes";
import { setQuoteStatusAction, type OpsResult } from "../order-actions";

const initial: OpsResult = {};

/**
 * Moving a quote along.
 *
 * A select rather than a row of buttons, unlike the order board. An order has
 * constrained transitions worth rendering as legal moves (D-020); a quote does
 * not, because "we called them and it went nowhere" can happen from any state
 * and back again. Modelling a state machine here would be inventing rules that
 * do not exist.
 */
export function QuoteStatus({ id, status }: { id: string; status: string }) {
  const [state, action] = useActionState(setQuoteStatusAction, initial);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Select
        name="status"
        defaultValue={status}
        aria-label="Quote status"
        className="h-8 py-0 text-caption"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {QUOTE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {QUOTE_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      {state.error && <p className="mt-1 text-caption text-danger">{state.error}</p>}
    </form>
  );
}
