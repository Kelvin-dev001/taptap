"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input, Alert, SwitchField } from "@/components/ui";
import { saveNotificationsAction, type SettingsState } from "./actions";
import type { NotifyPrefs } from "@/lib/notifications/preferences";

const initial: SettingsState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText="Saving…">
      Save changes
    </Button>
  );
}

export default function NotificationsForm({
  notify,
  ownerEmail,
}: {
  notify: NotifyPrefs;
  ownerEmail: string;
}) {
  const [state, action] = useActionState(saveNotificationsAction, initial);
  // Opt-out, not opt-in: a business that has never opened Settings is exactly
  // the one that most needs telling a lead arrived.
  const [enabled, setEnabled] = useState(notify.lead?.enabled !== false);

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Radix renders role="switch" on a button, which submits nothing. The
          hidden input carries the value, so the form posts what is on screen. */}
      <input type="hidden" name="leadEmailEnabled" value={enabled ? "on" : "off"} />

      <SwitchField
        label="Email me when a lead arrives"
        description="Sent as soon as someone submits your lead form, with their details so you can reply straight away."
        checked={enabled}
        onCheckedChange={setEnabled}
      />

      <Field
        label="Send to"
        hint={`Leave blank to use your sign-in address (${ownerEmail}).`}
      >
        <Input
          name="leadEmailTo"
          type="email"
          placeholder={ownerEmail}
          defaultValue={notify.lead?.to ?? ""}
          disabled={!enabled}
        />
      </Field>

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <div>
        <SaveButton />
      </div>
    </form>
  );
}
