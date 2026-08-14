"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input, Alert } from "@/components/ui";
import {
  saveBusinessProfileAction,
  type BusinessProfile,
  type SettingsState,
} from "./actions";

const initial: SettingsState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText="Saving…">
      Save changes
    </Button>
  );
}

export default function SettingsForm({
  name,
  profile,
}: {
  name: string;
  profile: BusinessProfile;
}) {
  const [state, action] = useActionState(saveBusinessProfileAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Business name" required error={state.error}>
        <Input name="name" defaultValue={name} required maxLength={120} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" hint="e.g. Coffee shop, Salon, Car dealer">
          <Input name="category" defaultValue={profile.category ?? ""} />
        </Field>
        <Field label="Location" hint="Area or town, e.g. Westlands, Nairobi">
          <Input name="location" defaultValue={profile.location ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" inputMode="tel" defaultValue={profile.phone ?? ""} placeholder="0712 345 678" />
        </Field>
        <Field label="WhatsApp" hint="If different from your phone number">
          <Input
            name="whatsapp"
            type="tel"
            inputMode="tel"
            defaultValue={profile.whatsapp ?? ""}
            placeholder="0712 345 678"
          />
        </Field>
        <Field label="Website">
          <Input
            name="website"
            type="url"
            inputMode="url"
            defaultValue={profile.website ?? ""}
            placeholder="https://yourbusiness.co.ke"
          />
        </Field>
        <Field label="Google review link" hint="Customers land here from a review card">
          <Input
            name="googleReviewUrl"
            type="url"
            inputMode="url"
            defaultValue={profile.googleReviewUrl ?? ""}
            placeholder="https://g.page/r/…"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton />
      </div>

      {state.success && <Alert tone="success">{state.success}</Alert>}
    </form>
  );
}
