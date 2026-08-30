import { LoginForm } from "./login-form";
import { safeNext } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

/**
 * Server shell for the sign-in screen.
 *
 * Exists only to read the query string. /auth/callback redirects here with
 * `?error=…` when a confirmation link has expired or was already opened, and
 * `requireStaff` sends signed-out staff here with `?next=/admin`. Reading both
 * on the server keeps the form a plain client island — no useSearchParams, so
 * no Suspense boundary, and no effect that sets state on mount.
 *
 * `next` is validated HERE rather than trusted downstream, so the form only
 * ever receives a path that is already known to be same-origin.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const { error, next } = await searchParams;
  const initialError = Array.isArray(error) ? error[0] : error;
  const target = safeNext(Array.isArray(next) ? next[0] : next);

  return <LoginForm initialError={initialError} next={target} />;
}
