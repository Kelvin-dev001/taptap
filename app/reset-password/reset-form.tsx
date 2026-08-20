"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Button, Field, Input, Alert, Card } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";

/** Matches the minLength on the sign-up field, and Supabase's own floor. */
const MIN_LENGTH = 8;

export function ResetForm({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Checked here as well as by the input's minLength, because minLength is a
    // browser convenience and says nothing about what actually reaches Supabase.
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    // Confirmed rather than assumed: a typo in the only copy of a new password
    // locks someone out of the account they were in the middle of recovering.
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      // The recovery link already established a session, so there is nothing
      // left to sign in to — go straight in.
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <Wordmark subtitle="Business suite" />

      <Card padding="md">
        <h1 className="mb-1 text-page-title text-foreground">Choose a new password</h1>
        <p className="mb-5 text-body-sm text-muted">
          For <span className="text-foreground">{email}</span>. You are signed in — this
          just replaces your password.
        </p>

        {error && (
          <Alert tone="danger" className="mb-4 animate-rise-in">
            {error}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="New password" required hint={`At least ${MIN_LENGTH} characters.`}>
            <Input
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_LENGTH}
            />
          </Field>

          <Field label="Confirm new password" required>
            <Input
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={MIN_LENGTH}
            />
          </Field>

          <Button type="submit" loading={loading} loadingText="Saving…" full>
            Save new password
          </Button>
        </form>
      </Card>
    </main>
  );
}
