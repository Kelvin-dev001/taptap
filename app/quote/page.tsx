import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Wordmark } from "@/components/shell/logo";
import { WhatsAppButton } from "@/components/marketing/whatsapp-button";
import { HARDWARE_PRICE_KES, RENEWAL_PER_IDENTITY_KES, formatKes } from "@/lib/pricing";
import { QuoteForm } from "./quote-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Talk to sales",
  description:
    "Kitting out a team with Hornbill TapTap? Tell us roughly how many cards you need and we will send you a quote.",
};

/**
 * Corporate enquiries (D-021).
 *
 * Replaces the `mailto:` the pricing page used to offer. A mailto loses the
 * enquiry the moment someone opens it on a phone with no mail client set up,
 * and it leaves no record for staff to work from. This writes a row the ops
 * console can pick up.
 *
 * Public, because most people asking have not signed up yet. When a signed-in
 * customer asks, `submit_quote_request` links it to their account so staff can
 * see what they already own.
 */
export default async function QuotePage() {
  // Prefills the email for someone already signed in. Not required, and its
  // absence is not an error: this page works logged out.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <Wordmark subtitle="Talk to sales" />
        <h1 className="text-display text-foreground">Kitting out a team</h1>
        <p className="text-body text-foreground-secondary">
          Buying for twenty people or two hundred? Tell us roughly what you need and we will
          come back with a quote and an invoice. We handle the setup with you, so nobody on
          your team has to work out how any of it fits together.
        </p>
      </div>

      <QuoteForm defaultEmail={user?.email ?? ""} />

      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <h2 className="text-section-title text-foreground">Buying one or two instead?</h2>
        <p className="text-body-sm text-foreground-secondary">
          You do not need a quote for that. A Smart Card is{" "}
          {formatKes(HARDWARE_PRICE_KES.card)} and a Smart Stand is{" "}
          {formatKes(HARDWARE_PRICE_KES.stand)}, each including your first twelve months,
          then {formatKes(RENEWAL_PER_IDENTITY_KES)} a year.{" "}
          <Link href="/pricing" className="underline">
            See pricing
          </Link>{" "}
          or{" "}
          <Link href="/login" className="underline">
            get started
          </Link>
          .
        </p>
      </div>

      <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-caption text-muted">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <Link href="/pricing" className="hover:text-foreground">
          Pricing
        </Link>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
      </footer>
      <WhatsAppButton />
    </main>
  );
}
