import Link from "next/link";
import { Alert, Card, buttonVariants } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";
import { createServerSupabase } from "@/lib/supabase/server";
import { DeleteAccountForm } from "./delete-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Delete your account",
  description: "How to delete your Hornbill TapTap account, and what is deleted and kept.",
};

const SUPPORT = "info@hornbilltech.co.ke";

/**
 * /account/delete (PLAN.md §9 W7, M6). Google Play requires a web page where
 * anyone can learn how to delete their account and do it without the app; the
 * App Store listing links here too. Readable signed out (proxy.ts does not
 * cover it, on purpose), and the deletion itself needs a fresh sign-in.
 *
 * What goes and what stays is D-047, in the app's own words.
 */
export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string | string[] }>;
}) {
  const { done } = await searchParams;
  const finished = done === "account" || done === "member" ? done : null;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = finished ? { data: { user: null } } : await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-10">
      <Wordmark subtitle="Business suite" />

      <div>
        <h1 className="mb-1 text-page-title text-foreground">Delete your Hornbill TapTap account</h1>
        <p className="text-body-sm text-muted">
          Deleting your account can&apos;t be undone. Here is exactly what happens.
        </p>
      </div>

      {finished && (
        <Alert tone="success" title={finished === "member" ? "You've been removed" : "Your account has been deleted"}>
          {finished === "member"
            ? "You've been removed from the business account. Everyone else keeps it."
            : "You've been signed out. Thank you for using Hornbill TapTap."}
        </Alert>
      )}

      <Card padding="md">
        <section className="flex flex-col gap-4 text-body-sm text-foreground-secondary">
          <div>
            <h2 className="mb-1 text-section-title text-foreground">What&apos;s deleted</h2>
            <p>
              Your profiles, their actions and analytics, and every lead. Your cards stop working:
              anyone who taps one sees nothing.
            </p>
          </div>
          <div>
            <h2 className="mb-1 text-section-title text-foreground">What&apos;s kept</h2>
            <p>
              Payment and order records, with your name, phone number and delivery details removed,
              for 5 years, as Kenyan tax law requires.
            </p>
          </div>
          <div>
            <h2 className="mb-1 text-section-title text-foreground">If others share this business</h2>
            <p>
              Only you are removed. The business, its profiles, cards and leads stay for everyone
              else.
            </p>
          </div>
        </section>
      </Card>

      {!finished && (
        <Card padding="md">
          {user?.email ? (
            <DeleteAccountForm email={user.email} />
          ) : (
            <div className="flex flex-col gap-3">
              <h2 className="text-section-title text-foreground">Delete it here</h2>
              <p className="text-body-sm text-muted">
                Sign in first, and you&apos;ll come straight back to this page.
              </p>
              <Link href="/login?next=/account/delete" className={buttonVariants({ variant: "primary", full: true })}>
                Sign in to delete your account
              </Link>
            </div>
          )}
        </Card>
      )}

      <section className="flex flex-col gap-2 text-body-sm text-muted">
        <h2 className="text-section-title text-foreground">Other ways</h2>
        <p>
          <span className="text-foreground">In the TapTap app:</span> Account → Delete account.
        </p>
        <p>
          <span className="text-foreground">Can&apos;t sign in?</span> Email{" "}
          <a href={`mailto:${SUPPORT}?subject=Delete%20my%20account`} className="underline">
            {SUPPORT}
          </a>{" "}
          from the address on your account, and we&apos;ll delete it for you and confirm by email.
        </p>
        <p>
          More in our{" "}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
