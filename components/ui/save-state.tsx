"use client";

import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * "Saving… → Saved ✓" — the answer to UI-0's finding that users cannot tell
 * whether a change persisted. Lives in an aria-live region so the transition is
 * announced, not just drawn (WCAG 4.1.3).
 *
 * The editor (UI-4) owns the timing: set "saved" on success and back to "idle"
 * after a beat.
 */
export function SaveState({
  status,
  savedLabel = "Saved",
  errorLabel = "Not saved",
  className,
}: {
  status: SaveStatus;
  savedLabel?: string;
  errorLabel?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-caption transition-opacity duration-base ease-standard",
        status === "idle" ? "opacity-0" : "opacity-100",
        status === "error" ? "text-danger" : "text-muted",
        className,
      )}
    >
      {status === "saving" && (
        <>
          <Spinner className="h-3 w-3" />
          Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          {savedLabel}
        </>
      )}
      {status === "error" && (
        <>
          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          {errorLabel}
        </>
      )}
    </span>
  );
}
