import Link from "next/link";
import { SearchX } from "lucide-react";
import { Wordmark } from "@/components/shell/logo";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata = { title: "Link not found" };

/**
 * Shown when a tapped card or scanned code resolves to nothing — a deleted
 * profile, an unpublished one, or a mistyped link.
 *
 * This is the one 404 in the product with a real audience: a customer standing
 * in a shop who has just tapped a card. A stock error page tells them the
 * business is broken, so this says what happened in plain words, avoids
 * blaming them, and gives them somewhere to go.
 */
export default function SlugNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark />

      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
        <SearchX className="h-5 w-5 text-muted" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-page-title text-foreground">This link isn&rsquo;t active</h1>
        <p className="text-body-sm text-muted">
          The card or code you used doesn&rsquo;t point anywhere right now. The business may
          have taken it down, or it may not be set up yet.
        </p>
      </div>

      <Link href="/" className={cn(buttonVariants({ variant: "secondary" }))}>
        About Hornbill TapTap
      </Link>

      <p className="text-caption text-muted">
        If this is your card,{" "}
        <Link href="/dashboard" className="underline">
          sign in to check it
        </Link>
        .
      </p>
    </main>
  );
}
