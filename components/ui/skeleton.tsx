import { cn } from "@/lib/cn";

/**
 * Loading placeholder. Marked aria-hidden because the region it fills should
 * own the announcement (aria-busy / a status message) — a screen reader has
 * nothing useful to say about a grey rectangle.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block overflow-hidden rounded-md bg-surface-sunken",
        // Sheen is opacity/transform-based, so reduced-motion neutralises it.
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent",
        className,
      )}
    />
  );
}

/** Convenience: a few stacked text lines, last one short. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 && "w-2/3")} />
      ))}
    </div>
  );
}
