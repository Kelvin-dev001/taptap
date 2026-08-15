"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { Wordmark } from "@/components/shell/logo";

/**
 * Application error boundary.
 *
 * Next's default error page is a developer artefact — it says "Application
 * error: a client-side exception has occurred", which tells a shop owner
 * nothing and looks like the product is broken beyond use. This offers the one
 * thing that usually works (retry) and admits the fault is ours.
 *
 * The digest is shown deliberately: it is the only handle a customer can quote
 * in a support message, and it identifies the error without exposing the stack.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Until error reporting is wired up, the server log is what exists.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark />

      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
        <TriangleAlert className="h-5 w-5 text-danger" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-page-title text-foreground">Something went wrong</h1>
        <p className="text-body-sm text-muted">
          That&rsquo;s our fault, not yours. Nothing has been lost — try again, and if it keeps
          happening let us know.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        {/*
          A plain anchor on purpose. This boundary catches errors that can leave
          the client router in a bad state, and a full page load is the reliable
          way out — next/link would soft-navigate and could land straight back
          here.
        */}
        <Button variant="secondary" asChild>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/dashboard">Back to dashboard</a>
        </Button>
      </div>

      {error.digest && (
        <p className="text-caption text-muted">
          Reference: <code className="rounded bg-surface-sunken px-1">{error.digest}</code>
        </p>
      )}
    </main>
  );
}
