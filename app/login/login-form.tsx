"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Button, Field, Input, Alert, Card, GoogleMark } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";

type Mode = "signin" | "signup";
/** What we told the user we emailed them, so the confirmation panel can say so. */
type SentKind = "link" | "confirm";

/**
 * Sign-in / sign-up.
 *
 * Three ways in, ordered by how little they ask of the user:
 *
 *   Google       one tap, pre-verified, no email round-trip. Most Kenyan
 *                businesses already run on Gmail, so this is the default path.
 *   Magic link   one field, no password to invent or forget. Signs in and
 *                creates the account in the same step, so there is no separate
 *                confirm-then-sign-in journey to lose people in.
 *   Password     kept deliberately. Some people prefer it, and it is the escape
 *                hatch when a provider is down — but it is disclosed, not
 *                dangled, because it is the highest-friction option.
 *
 * Fixes UI-0 finding A4: the inputs had no labels and the buttons sat outside
 * any <form>, so pressing Enter did nothing and errors were never announced.
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
  const [usePassword, setUsePassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  /** Which control is busy, so only that one shows a spinner. */
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [sent, setSent] = useState<{ to: string; kind: SentKind } | null>(null);

  const redirectTo = () =>
    typeof window === "undefined" ? undefined : `${window.location.origin}/auth/callback`;

  /**
   * Everything runs inside one try: a misconfigured build makes
   * createBrowserSupabase() throw, and an unhandled rejection would leave the
   * button spinning with nothing said — which is exactly how "login is not
   * working" looks from the outside.
   */
  function failed(err: unknown) {
    setError(err instanceof Error ? err.message : "Could not sign in. Please try again.");
  }

  async function onGoogle() {
    setBusy("google");
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo() },
      });
      // On success the browser navigates to Google, so nothing after this runs.
      if (error) {
        setError(error.message);
        setBusy(null);
      }
    } catch (err) {
      failed(err);
      setBusy(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);

    try {
      const supabase = createBrowserSupabase();

      // --- Magic link: the default email path ---------------------------------
      if (!usePassword) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: redirectTo(),
            // Sign-in and sign-up are the same action here, so the toggle at the
            // bottom changes the wording rather than the mechanics. Guarding on
            // `signin` avoids silently creating an account for a mistyped
            // address that the user believed already existed.
            shouldCreateUser: mode === "signup",
          },
        });
        if (error) {
          setError(error.message);
          return;
        }
        setSent({ to: email, kind: "link" });
        return;
      }

      // --- Password: retained fallback ----------------------------------------
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
          emailRedirectTo: redirectTo(),
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSent({ to: email, kind: "confirm" });
    } catch (err) {
      failed(err);
    } finally {
      setBusy(null);
    }
  }

  /**
   * Post-send state.
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
  if (sent) {
    const isLink = sent.kind === "link";
    const spoken = isLink
      ? "Check your email. We sent you a sign-in link."
      : "Account created. Check your email to activate, then sign in.";

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
              {spoken}
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
              {isLink ? "We sent a sign-in link to" : "We sent an activation link to"}
            </p>
            <p
              className="animate-rise-in break-all text-body font-medium text-foreground"
              style={{ animationDelay: "160ms" }}
              aria-hidden
            >
              {sent.to}
            </p>

            <p
              className="mt-4 animate-rise-in text-body-sm text-muted"
              style={{ animationDelay: "220ms" }}
              aria-hidden
            >
              {isLink
                ? "Open it on this device and you will be signed in — no password needed."
                : "Click the link to activate your account, then sign in."}{" "}
              It can take a minute to arrive — check spam if you do not see it.
            </p>

            <div className="mt-6 w-full animate-rise-in" style={{ animationDelay: "280ms" }}>
              <Button
                variant="secondary"
                full
                onClick={() => {
                  setSent(null);
                  setPassword("");
                }}
              >
                Back
              </Button>
            </div>
          </div>
        </Card>
      </main>
    );
  }

  const emailActionLabel = usePassword
    ? mode === "signin"
      ? "Sign in"
      : "Create account"
    : "Email me a sign-in link";

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

        <Button
          variant="secondary"
          full
          size="lg"
          onClick={onGoogle}
          loading={busy === "google"}
          loadingText="Opening Google"
          disabled={busy !== null}
        >
          <GoogleMark className="h-[18px] w-[18px]" />
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          <span className="text-caption uppercase tracking-wide text-muted">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

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

          {usePassword && (
            <div className="animate-rise-in">
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
            </div>
          )}

          <Button type="submit" loading={busy === "email"} disabled={busy !== null} full>
            {emailActionLabel}
          </Button>
        </form>

        <p className="mt-4 text-center text-body-sm text-muted">
          <button
            type="button"
            onClick={() => {
              setUsePassword(!usePassword);
              setError(null);
            }}
            className="rounded font-medium text-primary-strong hover:underline"
          >
            {usePassword ? "Email me a link instead" : "Use a password instead"}
          </button>
        </p>

        <p className="mt-5 border-t border-border pt-5 text-center text-body-sm text-muted">
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
