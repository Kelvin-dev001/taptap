"use client";

import { useActionState, useState, useTransition } from "react";
import { Alert, Button, CheckboxField, Field, Input } from "@/components/ui";
import { deleteAccountAction, sendDeletionCodeAction, type DeleteState } from "./actions";

type Method = "password" | "code";

/** Matches Supabase's email OTP length (6 since M1). */
const CODE_LENGTH = 6;

/**
 * Prove it's you (password, or a code by email), tick to confirm, delete. The
 * same steps as the app's Delete account screen; the server does every check.
 */
export function DeleteAccountForm({ email }: { email: string }) {
  const [state, formAction, deleting] = useActionState<DeleteState, FormData>(deleteAccountAction, {
    error: null,
  });
  const [method, setMethod] = useState<Method>("password");
  const [confirmed, setConfirmed] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  function sendCode() {
    setCodeError(null);
    startSending(async () => {
      const result = await sendDeletionCodeAction();
      if (result.error) setCodeError(result.error);
      else setCodeSent(true);
    });
  }

  const error = state.error ?? codeError;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="method" value={method} />
      <p className="text-body-sm text-muted">
        Signed in as <span className="text-foreground">{email}</span>. Confirm it&apos;s you:
      </p>

      {method === "password" ? (
        <>
          <Field label="Password" required>
            <Input type="password" name="password" autoComplete="current-password" required />
          </Field>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMethod("code")}>
            Use an emailed code instead
          </Button>
        </>
      ) : (
        <>
          {codeSent ? (
            <Field label={`${CODE_LENGTH}-digit code`} required hint={`We sent it to ${email}.`}>
              <Input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={CODE_LENGTH}
                required
              />
            </Field>
          ) : (
            <Button type="button" variant="secondary" onClick={sendCode} loading={sending} loadingText="Sending…">
              Email me a code
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setMethod("password")}>
            Use your password instead
          </Button>
        </>
      )}

      <CheckboxField
        name="confirm"
        checked={confirmed}
        onCheckedChange={(v) => setConfirmed(v === true)}
        label="I understand my account is deleted for good, and this can't be undone."
      />

      {error && (
        <Alert tone="danger" className="animate-rise-in">
          {error}
        </Alert>
      )}

      <Button
        type="submit"
        variant="danger"
        loading={deleting}
        loadingText="Deleting…"
        disabled={!confirmed || (method === "code" && !codeSent)}
        full
      >
        Delete my account
      </Button>
    </form>
  );
}
