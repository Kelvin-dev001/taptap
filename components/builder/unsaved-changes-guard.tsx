"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui";

/**
 * Warns before unsaved builder changes are thrown away.
 *
 * `beforeunload` only covers leaving the site — reloads, closing the tab, an
 * external link. It does nothing for App Router navigation, so clicking
 * "Analytics" in the sidebar silently discarded everything an owner had typed.
 *
 * The App Router has no navigation-event API to hook, so this intercepts the
 * click instead, in the capture phase, before Next's own handler runs. When
 * there is nothing to lose it does not interfere at all.
 *
 * Uses the design system's ConfirmDialog rather than `window.confirm`, which
 * cannot be styled and reads as a browser error.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  // Leaving the site entirely.
  React.useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);

  // Navigating within the app.
  React.useEffect(() => {
    if (!when) return;

    const onClick = (event: MouseEvent) => {
      // Let the browser handle anything that is not a plain left click on a
      // same-tab internal link: new tabs, downloads, modified clicks and
      // external destinations are all the user's explicit choice.
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Staying on the same page (e.g. a query-string change) loses nothing.
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search);
    };

    // Capture phase: Next's Link handles clicks on bubble, so this must run
    // first to be able to stop it.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [when]);

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      onOpenChange={(open) => !open && setPendingHref(null)}
      title="Leave without saving?"
      description="You have changes that have not been saved. Leaving this page will discard them."
      confirmLabel="Discard changes"
      cancelLabel="Stay on this page"
      destructive
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) router.push(href);
      }}
    />
  );
}
