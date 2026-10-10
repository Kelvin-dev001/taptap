import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";
import { emailLinkTarget } from "@/lib/email-link";
import { confirmEmailLink } from "./actions";
import { ContinueButton } from "./continue-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Continue — Hornbill TapTap",
  robots: { index: false, follow: false },
};

/**
 * Where emailed sign-in links land (W8, docs/mobile/PLAN.md §9).
 *
 * Opening this page does nothing on its own: the one-time token is only used
 * when the person presses Continue, which posts the form. That is the point.
 * Corporate mail scanners open every link in an email to check it, and when the
 * link used the token on open (/auth/callback), the scanner spent it — and the
 * code printed in the same email with it — before the person ever clicked.
 * A scanner fetches pages; it does not submit forms.
 *
 * The mobile app opens this same URL as a link into the app (M6), so the path
 * and its query string are a contract with the email templates and the app.
 */

type Copy = { title: string; body: string };

const COPY: Record<"signIn" | "recovery" | "emailChange", Copy> = {
  signIn: { title: "Sign in to TapTap", body: "Press continue to finish signing in." },
  recovery: {
    title: "Reset your password",
    body: "Press continue, then choose a new password.",
  },
  emailChange: { title: "Confirm your new email", body: "Press continue to confirm it." },
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(key, first);
  }

  const target = emailLinkTarget(query);
  if (target.kind === "callback") redirect(`/auth/callback?${target.query}`);
  if (target.kind === "none") redirect("/login");
  if (target.kind === "invalid") {
    redirect(`/login?error=${encodeURIComponent("This link is not valid. Request a new one.")}`);
  }

  const copy =
    COPY[
      target.type === "recovery"
        ? "recovery"
        : target.type === "email_change"
          ? "emailChange"
          : "signIn"
    ];

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <Wordmark subtitle="Business suite" />

      <Card padding="md">
        <h1 className="mb-1 text-page-title text-foreground">{copy.title}</h1>
        <p className="mb-5 text-body-sm text-muted">{copy.body}</p>

        <form action={confirmEmailLink}>
          <input type="hidden" name="token_hash" value={target.tokenHash} />
          <input type="hidden" name="type" value={target.type} />
          <input type="hidden" name="next" value={target.next} />
          <ContinueButton />
        </form>
      </Card>
    </main>
  );
}
