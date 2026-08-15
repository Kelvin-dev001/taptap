"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Nfc } from "lucide-react";
import { Button, Card, Field, Select, Alert } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";
import { claimTagAction, type ClaimResult } from "./actions";

const initial: ClaimResult = {};

type PageOpt = { id: string; slug: string; title: string | null };

function LinkButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText="Linking…" full>
      Link this card
    </Button>
  );
}

/**
 * Card claim.
 *
 * Migrated to the design system in UI-12 — this and the pages around it were
 * missed by every previous sprint, which is awkward given it sits on the core
 * NFC path: it is the first authenticated screen a customer sees after tapping
 * a brand new card, and it was still on pre-design-system styling with an
 * unlabelled select.
 */
export default function ClaimForm({
  token,
  pages,
}: {
  token: string;
  pages: PageOpt[];
}) {
  const [state, action] = useActionState(claimTagAction, initial);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <Wordmark subtitle="Business suite" />

      <Card padding="md" className="flex flex-col gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
          <Nfc className="h-5 w-5 text-primary-strong" aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-1">
          <h1 className="text-page-title text-foreground">Link your card</h1>
          <p className="text-body-sm text-muted">
            Choose which profile this card should open. You can change it later without
            touching the card again.
          </p>
        </div>

        {pages.length === 0 ? (
          <Alert tone="info" title="You have no profiles yet">
            Create one in your dashboard, then tap this card again to link it.
          </Alert>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />
            <Field label="Point this card to" required error={state.error}>
              <Select name="pageId" required>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || `/${p.slug}`}
                  </option>
                ))}
              </Select>
            </Field>
            <LinkButton />
          </form>
        )}
      </Card>
    </main>
  );
}
