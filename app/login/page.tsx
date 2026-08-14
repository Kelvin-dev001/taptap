"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Button, Field, Input, Alert, Card } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";

type Mode = "signin" | "signup";

/**
 * Migrated to the design system in UI-2. Fixes UI-0 finding A4: the inputs had
 * no labels and the buttons sat outside any <form>, so pressing Enter did
 * nothing and errors were never announced. It is now a real form with a submit
 * handler, associated labels and an alert-role message.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createBrowserSupabase();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage(
      "Account created. If email confirmation is on, confirm via email, then sign in.",
    );
    setMode("signin");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <Wordmark subtitle="Business suite" />

      <Card padding="md">
        <h1 className="mb-1 text-page-title text-foreground">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mb-5 text-body-sm text-muted">
          {mode === "signin"
            ? "Manage your Tap Profiles, cards and customers."
            : "One account runs all your links and NFC cards."}
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Email" required error={error ?? undefined}>
            <Input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@business.co.ke"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label="Password" required>
            <Input
              type="password"
              name="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </Field>

          <Button type="submit" loading={loading} full>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {message && (
          <Alert tone="success" className="mt-4">
            {message}
          </Alert>
        )}

        <p className="mt-5 text-center text-body-sm text-muted">
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
            className="rounded font-medium text-primary-strong hover:underline"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </Card>
    </main>
  );
}
