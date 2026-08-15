"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Store, IdCard, CornerUpRight } from "lucide-react";
import { Button, Field, Input, Alert } from "@/components/ui";
import { TEMPLATE_ORDER, TEMPLATES, type ProfileTemplate } from "@/lib/templates";
import { cn } from "@/lib/cn";
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

const TEMPLATE_ICONS = { business: Store, card: IdCard } as const;

/**
 * Creation is a choice of what the link IS before any detail is asked for:
 * a business page, a personal card, or a plain redirect. Picking a template
 * seeds real actions from the business details in Settings, so the first
 * profile is useful immediately rather than an empty shell (§20).
 */
export default function CreateProfileForm() {
  const [state, formAction] = useActionState(createProfileAction, initialState);
  const [mode, setMode] = useState<"redirect" | "page">("page");
  const [template, setTemplate] = useState<ProfileTemplate>("business");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="template" value={template} />

      <fieldset>
        <legend className="mb-2 text-body-sm font-medium text-foreground">
          What are you making?
        </legend>
        <div className="flex flex-col gap-2">
          {TEMPLATE_ORDER.map((id) => {
            const def = TEMPLATES[id];
            const Icon = TEMPLATE_ICONS[id];
            const selected = mode === "page" && template === id;
            return (
              <TypeOption
                key={id}
                selected={selected}
                icon={Icon}
                label={def.label}
                description={def.description}
                onSelect={() => {
                  setMode("page");
                  setTemplate(id);
                }}
              />
            );
          })}
          <TypeOption
            selected={mode === "redirect"}
            icon={CornerUpRight}
            label="Single redirect"
            description="Send every tap straight to one link. No page is shown."
            onSelect={() => setMode("redirect")}
          />
        </div>
      </fieldset>

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

      <Field label={mode === "page" && template === "card" ? "Your name" : "Title"} hint="Optional">
        <Input
          name="title"
          placeholder={
            mode === "page" ? TEMPLATES[template].namePlaceholder : "Java House Nairobi"
          }
        />
      </Field>

      {mode === "redirect" && (
        <Field label="Redirect to" required>
          <Input
            name="destination"
            required
            inputMode="url"
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

function TypeOption({
  selected,
  icon: Icon,
  label,
  description,
  onSelect,
}: {
  selected: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors duration-fast",
        selected
          ? "border-primary bg-primary-subtle"
          : "border-border hover:border-border-strong hover:bg-surface-sunken",
      )}
    >
      <input
        type="radio"
        name="profile-type"
        checked={selected}
        onChange={onSelect}
        className="mt-1 accent-primary-strong"
      />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
          <Icon className="h-3.5 w-3.5 text-muted" />
          {label}
        </span>
        <span className="text-caption text-muted">{description}</span>
      </span>
    </label>
  );
}
