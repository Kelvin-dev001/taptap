"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createProfileAction, type CreateState } from "./actions";

const initialState: CreateState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create link"}
    </button>
  );
}

export default function CreateProfileForm() {
  const [state, formAction] = useFormState(createProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="text-sm font-medium">Link name (slug)</label>
      <div className="flex items-center gap-1">
        <span className="text-sm text-neutral-500">taptap.hornbilltech.co.ke/</span>
        <input
          name="slug"
          required
          placeholder="java-house"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
      </div>

      <label className="text-sm font-medium">Title (optional)</label>
      <input
        name="title"
        placeholder="Java House Nairobi"
        className="rounded-lg border border-neutral-300 px-3 py-2"
      />

      <label className="text-sm font-medium">Redirect to</label>
      <input
        name="destination"
        required
        placeholder="https://g.page/r/... or https://wa.me/2547..."
        className="rounded-lg border border-neutral-300 px-3 py-2"
      />

      <SubmitButton />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
