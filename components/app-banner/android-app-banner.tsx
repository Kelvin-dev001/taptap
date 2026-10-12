"use client";

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { IconButton, buttonVariants } from "@/components/ui";

/** Remembered per browser; a dismissed banner never comes back. */
export const DISMISS_KEY = "taptap.appBanner.dismissed";

const noopSubscribe = () => () => {};

/**
 * Whether this is an Android browser that has not dismissed the banner. Read
 * during render through useSyncExternalStore (hydration-safe: the server
 * snapshot is false), like components/ops/scanning.tsx.
 */
function useWantsBanner(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      if (!/Android/i.test(navigator.userAgent)) return false;
      try {
        return localStorage.getItem(DISMISS_KEY) === null;
      } catch {
        // Storage blocked (private mode, strict settings): show it, and a
        // dismissal simply lasts for this page.
        return true;
      }
    },
    () => false,
  );
}

/**
 * "Get the app" for Android visitors (PLAN.md §9 W11). iPhones get Safari's own
 * Smart App Banner from the `itunes` metadata instead. Placed on `/` and the
 * dashboard only — never on profiles or card taps, which belong to the business
 * (app/app-banner-placement.test.ts). Renders nothing until there is a listing.
 */
export function AndroidAppBanner({ playUrl }: { playUrl: string | null }) {
  const wants = useWantsBanner();
  const [dismissed, setDismissed] = useState(false);
  if (!playUrl || !wants || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // See above: it stays dismissed for this page.
    }
  }

  return (
    <aside
      aria-label="Get the TapTap app"
      className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5 motion-safe:animate-rise-in"
    >
      <p className="min-w-0 flex-1 text-body-sm text-foreground">
        <span className="font-semibold">TapTap for Android</span>
        <span className="text-muted"> — leads and cards in your pocket.</span>
      </p>
      <a href={playUrl} className={buttonVariants({ variant: "primary", size: "sm" })}>
        Get the app
      </a>
      <IconButton label="Dismiss" onClick={dismiss}>
        <X className="h-4 w-4" aria-hidden />
      </IconButton>
    </aside>
  );
}
