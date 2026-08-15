import { WifiOff } from "lucide-react";
import { Wordmark } from "@/components/shell/logo";

export const metadata = { title: "You're offline — Hornbill TapTap" };

/**
 * Shown when a page is requested with no connection and nothing cached.
 *
 * Kept deliberately static so it can be pre-cached by the service worker: it
 * fetches nothing, so it always renders.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark subtitle="Business suite" />

      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
        <WifiOff className="h-5 w-5 text-muted" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-page-title text-foreground">You&rsquo;re offline</h1>
        <p className="text-body-sm text-muted">
          We can&rsquo;t reach Hornbill TapTap right now. Pages you&rsquo;ve already opened will
          still work — reconnect and try again.
        </p>
      </div>
    </main>
  );
}
