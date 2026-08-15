import Link from "next/link";
import { Compass } from "lucide-react";
import { Wordmark } from "@/components/shell/logo";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata = { title: "Page not found" };

/** Catch-all 404 for platform routes. Customer-facing links use app/[slug]/not-found.tsx. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark />

      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
        <Compass className="h-5 w-5 text-muted" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-page-title text-foreground">Page not found</h1>
        <p className="text-body-sm text-muted">
          This page doesn&rsquo;t exist, or it moved.
        </p>
      </div>

      <Link href="/dashboard" className={cn(buttonVariants())}>
        Back to dashboard
      </Link>
    </main>
  );
}
