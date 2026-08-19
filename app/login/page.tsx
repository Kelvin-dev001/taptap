import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/**
 * Server shell for the sign-in screen.
 *
 * Exists only to read the query string. /auth/callback redirects here with
 * `?error=…` when a confirmation link has expired or was already opened, and
 * reading that on the server keeps the form a plain client island — no
 * useSearchParams, so no Suspense boundary, and no effect that sets state on
 * mount.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const initialError = Array.isArray(error) ? error[0] : error;

  return <LoginForm initialError={initialError} />;
}
