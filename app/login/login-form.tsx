"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Button, Field, Input, Alert, Card } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";

type Mode = "signin" | "signup";

/**
 * Migrated to the design system in UI-2. Fixes UI-0 finding A4: the inputs had
 * no labels and the buttons sat outside any <form>, so pressing Enter did
 * nothing and errors were never announced. It is now a real form with a submit
 * handler, associated labels and an alert-role message.
 *
 * `initialError` is read from the query string by the server page rather than
 * with useSearchParams here: /auth/callback reports expired or already-used
 * links that way, and seeding it through a prop keeps this an ordinary client
 * island with no Suspense boundary and no state-setting effect.
 */
export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  /** Set once signup succeeds; swaps the form for the check-your-email panel. */
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Everything here runs in one try: a misconfigured build makes
    // createBrowserSupabase() throw, and an unhandled rejection would leave the
    // button spinning with nothing said — which is exactly how "login is not
    // working" looks from the outside.
    try {
      const supabase = createBrowserSupabase();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Without this, Supabase falls back to the project's Site URL — which
          // was still localhost, so every confirmation email sent a real user to
          // a machine that was not theirs. Deriving it from the current origin
          // keeps local, preview and production each pointing at themselves.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Post-signup state.
   *
   * Replaces the form rather than adding a note beneath it: the next thing to
   * do is open an inbox, not fill the fields in again. The old flow flipped
   * back to "Sign in" behind a success message, which invited people to try
   * signing in before confirming — and then fail.
   *
   * The motion is staged to lead the eye in the order the steps happen: badge,
   * heading, address, instruction, way back. Each is a token-driven entrance
   * that plays once, never a loop, and the global reduced-motion rule collapses
   * all of it to 1ms.
   */
  if (sentTo) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
        <Wordmark subtitle="Business suite" />

        <Card padding="md">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 flex h-14 w-14 animate-scale-in items-center justify-center rounded-full bg-primary-soft"
              aria-hidden
            >
              <MailCheck className="h-7 w-7 text-primary-strong" />
            </div>

            {/* One polite announcement carries the whole outcome; the staged
                pieces below are visual only, so a screen reader hears it once. */}
            <p role="status" className="sr-only">
              Account created. Check your email to activate, then sign in.
            </p>

            <h1
              className="animate-rise-in text-page-title text-foreground"
              style={{ animationDelay: "60ms" }}
              aria-hidden
            >
              Check your email
            </h1>

            <p
              className="mt-2 animate-rise-in text-body-sm text-muted"
              style={{ animationDelay: "120ms" }}
              aria-hidden
            >
              We sent an activation link to
            </p>
            <p
              className="animate-rise-in break-all text-body font-medium text-foreground"
              style={{ animationDelay: "160ms" }}
              aria-hidden
            >
              {sentTo}
            </p>

            <p
              className="mt-4 animate-rise-in text-body-sm text-muted"
              style={{ animationDelay: "220ms" }}
              aria-hidden
            >
              Click the link to activate your account, then sign in. It can take
              a minute to arrive — check spam if you do not see it.
            </p>

            <div
              className="mt-6 w-full animate-rise-in"
              style={{ animationDelay: "280ms" }}
            >
              <Button
                variant="secondary"
                full
                onClick={() => {
                  setSentTo(null);
                  setMode("signin");
                  setPassword("");
                }}
              >
                Back to sign in
              </Button>
            </div>
          </div>
        </Card>
      </main>
    );
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

        {/* Form-level, not field-level. Supabase deliberately does not say which
            of email or password was wrong, and an expired-link error from
            /auth/callback belongs to neither field — hanging either under the
            email input would point at the wrong thing. */}
        {error && (
          <Alert tone="danger" className="mb-4 animate-rise-in">
            {error}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Email" required>
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

        <p className="mt-5 text-center text-body-sm text-muted">
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
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
