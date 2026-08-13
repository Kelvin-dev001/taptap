"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { claimTagAction, type ClaimResult } from "./actions";

const initial: ClaimResult = {};

type PageOpt = { id: string; slug: string; title: string | null };

function LinkButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-900 px-5 py-2.5 font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Linking…" : "Link this card"}
    </button>
  );
}

export default function ClaimForm({
  token,
  pages,
}: {
  token: string;
  pages: PageOpt[];
}) {
  const [state, action] = useActionState(claimTagAction, initial);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold">Link your card</h1>
      {pages.length === 0 ? (
        <p className="text-sm text-neutral-600">
          You have no smart pages yet — create one in your dashboard, then tap the
          card again.
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <label className="text-sm font-medium">Point this card to:</label>
          <select
            name="pageId"
            required
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || `/${p.slug}`}
              </option>
            ))}
          </select>
          <LinkButton />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        </form>
      )}
    </main>
  );
}
