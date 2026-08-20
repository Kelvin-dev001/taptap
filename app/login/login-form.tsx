"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Button, Field, Input, Alert, Card, GoogleMark } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";

type Mode = "signin" | "signup" | "reset";
/** What we told the user we emailed them, so the confirmation panel can say so. */
type SentKind = "link" | "confirm" | "reset";

/**
 * Google is only offered once it actually works.
 *
 * The provider has to be enabled in the Supabase dashboard with credentials
 * from Google Cloud, and shipping the button before that is worse than not
 * having it: it is the most prominent control on the screen, and it would fail
 * for every person who trusted it. This flag lets the code land ahead of the
 * account setup.
 *
 * NEXT_PUBLIC_* is inlined at build time, so turning this on requires a
 * redeploy, not just an environment change. Read per render rather than at
 * module scope so a test can stub it.
 */
function googleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";
}

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

      // --- Password reset -----------------------------------------------------
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          // Lands on /auth/callback, which verifies the recovery token and
          // establishes a session, then forwards to the page where the new
          // password is actually set. `next` is validated there.
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (error) {
          setError(error.message);
          return;
        }
        setSent({ to: email, kind: "reset" });
        return;
      }

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
    const isReset = sent.kind === "reset";
    const spoken = isReset
      ? "Check your email. We sent you a link to set a new password."
      : isLink
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
              {isReset
                ? "We sent a password reset link to"
                : isLink
                  ? "We sent a sign-in link to"
                  : "We sent an activation link to"}
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
              {isReset
                ? "Open it and you can choose a new password."
                : isLink
                  ? "Open it and you will be signed in — no password needed."
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

  const isReset = mode === "reset";
  const emailActionLabel = isReset
    ? "Email me a reset link"
    : usePassword
      ? mode === "signin"
        ? "Sign in"
        : "Create account"
      : "Email me a sign-in link";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <Wordmark subtitle="Business suite" />

      <Card padding="md">
        <h1 className="mb-1 text-page-title text-foreground">
          {isReset
            ? "Reset your password"
            : mode === "signin"
              ? "Sign in"
              : "Create your account"}
        </h1>
        <p className="mb-5 text-body-sm text-muted">
          {isReset
            ? "Enter your email and we will send you a link to choose a new one."
            : mode === "signin"
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

        {googleEnabled() && !isReset && (
          <>
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
          </>
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

          {usePassword && !isReset && (
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
              {mode === "signin" && (
                <p className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setPassword("");
                    }}
                    className="rounded text-body-sm font-medium text-primary-strong hover:underline"
                  >
                    Forgot password?
                  </button>
                </p>
              )}
            </div>
          )}

          <Button type="submit" loading={busy === "email"} disabled={busy !== null} full>
            {emailActionLabel}
          </Button>
        </form>

        {!isReset && (
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
        )}

        <p className="mt-5 border-t border-border pt-5 text-center text-body-sm text-muted">
          {isReset ? (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className="rounded font-medium text-primary-strong hover:underline"
            >
              Back to sign in
            </button>
          ) : (
            <>
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
            </>
          )}
        </p>
      </Card>
    </main>
  );
}
