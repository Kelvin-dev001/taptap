import { cn } from "@/lib/cn";

/**
 * Decorative by default — the surrounding control owns the accessible status
 * (aria-busy on Button, aria-live regions elsewhere), so this is hidden from
 * assistive tech to avoid double announcements.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
