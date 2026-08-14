"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input, Alert } from "@/components/ui";
import { createProfileAction, type CreateState } from "./actions";

const initialState: CreateState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText="Creating…">
      Create link
    </Button>
  );
}

/**
 * Migrated to the design system in UI-2. Every control now has a real
 * associated label via `Field` — previously the labels were unassociated
 * `<label>` elements (UI-0 finding A1) and errors were an unlinked red
 * paragraph (A14).
 */
export default function CreateProfileForm() {
  const [state, formAction] = useActionState(createProfileAction, initialState);
  const [mode, setMode] = useState<"redirect" | "page">("redirect");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Link name"
        required
        hint="Lowercase letters, numbers and hyphens. This is the part customers see."
        error={state.error}
      >
        <div className="flex items-center gap-1">
          <span className="hidden shrink-0 text-body-sm text-muted sm:inline">
            taptap.hornbilltech.co.ke/
          </span>
          <Input name="slug" required placeholder="java-house" className="flex-1" />
        </div>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-medium text-foreground">Type</legend>
        <div className="flex flex-wrap gap-4 text-body-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="redirect"
              checked={mode === "redirect"}
              onChange={() => setMode("redirect")}
              className="accent-primary-strong"
            />
            Single redirect
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="page"
              checked={mode === "page"}
              onChange={() => setMode("page")}
              className="accent-primary-strong"
            />
            Smart page
          </label>
        </div>
      </fieldset>

      <Field label="Title" hint="Optional — shown at the top of a smart page.">
        <Input name="title" placeholder="Java House Nairobi" />
      </Field>

      {mode === "redirect" && (
        <Field label="Redirect to" required>
          <Input
            name="destination"
            required
            placeholder="https://g.page/r/… or https://wa.me/2547…"
          />
        </Field>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton />
      </div>

      {state.success && <Alert tone="success">{state.success}</Alert>}
    </form>
  );
}
