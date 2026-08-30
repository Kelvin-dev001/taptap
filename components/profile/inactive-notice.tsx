import Link from "next/link";
import { Clock } from "lucide-react";
import { Wordmark } from "@/components/shell/logo";

/**
 * Shown when every device pointing at a profile has lapsed (D-018).
 *
 * The reader of this screen is almost never the person who failed to pay — it
 * is a customer standing in a shop with a phone against a card. So it says the
 * card is not active *right now*, without implying the business is gone,
 * without blame, and without a 404 that would read as "this thing is broken".
 *
 * The route to renew is deliberately quiet and last: it is for the one visitor
 * in a hundred who owns the card.
 */
export function InactiveNotice({ title }: { title?: string | null }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <Wordmark />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken"
          aria-hidden="true"
        >
          <Clock className="h-5 w-5 text-muted" />
        </span>

        <h1 className="text-page-title text-foreground">
          {title ? `${title} isn’t available right now` : "This card isn’t active right now"}
        </h1>

        <p className="text-body-sm text-foreground-secondary">
          The link behind this card has been paused. If you were trying to reach a business,
          please contact them directly.
        </p>

        <p className="border-t border-border pt-3 text-caption text-muted">
          Own this card?{" "}
          <Link href="/dashboard/billing" className="underline">
            Renew it here
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
