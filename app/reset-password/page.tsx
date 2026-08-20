import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";

/**
 * Where a recovery link ends up.
 *
 * /auth/callback verifies the recovery token first, which establishes a
 * session — so by the time anyone reaches this page they are already signed in,
 * and `updateUser` has an identity to act on.
 *
 * That also makes the guard below the whole access control: no session means
 * the link was never followed, expired, or someone navigated here directly.
 * `proxy.ts` only matches /dashboard/:path*, so this page cannot lean on
 * middleware and checks for itself.
 */
export default async function ResetPasswordPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?error=${encodeURIComponent(
        "That password reset link has expired. Request a new one.",
      )}`,
    );
  }

  return <ResetForm email={user.email ?? ""} />;
}
