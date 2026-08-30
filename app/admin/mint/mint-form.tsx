"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { mintTagsAction, type MintResult } from "../actions";

const initial: MintResult = {};

function MintButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary-strong px-5 py-2.5 font-medium text-white hover:bg-primary-strong-hover disabled:opacity-50"
    >
      {pending ? "Minting…" : "Mint tokens"}
    </button>
  );
}

export default function MintForm() {
  const [state, action] = useActionState(mintTagsAction, initial);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        <label className="text-sm font-medium">Admin key</label>
        <input
          name="key"
          type="password"
          required
          className="h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-body-sm"
        />
        <label className="text-sm font-medium">How many cards?</label>
        <input
          name="count"
          type="number"
          min={1}
          max={500}
          defaultValue={10}
          className="h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-body-sm"
        />
        <MintButton />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>

      {state.urls && state.urls.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-green-700">
            Minted {state.urls.length}. Encode these onto the cards:
          </p>
          <textarea
            readOnly
            rows={Math.min(12, state.urls.length + 1)}
            className="w-full rounded-lg border border-border-strong bg-surface p-3 font-mono text-xs"
            value={state.urls.join("\n")}
          />
        </div>
      )}
    </div>
  );
}
