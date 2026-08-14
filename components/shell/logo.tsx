import { cn } from "@/lib/cn";

/**
 * Hornbill mark — a stylised hornbill silhouette in the brand orange on a
 * charcoal tile, matching the reference. Inline SVG so it costs no request and
 * inherits currentColor; there is no logo asset in the repo yet.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-inverse",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" role="img" aria-label="Hornbill TapTap">
        {/* head + body */}
        <path
          d="M15.2 5.6c-2.9 0-5.3 2.1-5.7 4.9l-2.9 2.2a.9.9 0 0 0 .2 1.5l1.6.7c.5 2.4 2.6 4.2 5.2 4.2 1 0 1.9-.3 2.7-.7l-.6-1.7a3.6 3.6 0 0 1-2.1.6c-1.9 0-3.4-1.4-3.5-3.3l-.1-.9-1.3-.6 2.2-1.7.1-.6a3.9 3.9 0 0 1 7.7.7c0 .6-.1 1.1-.3 1.6l1.8.6c.3-.7.4-1.4.4-2.2 0-3-2.4-5.3-5.4-5.3Z"
          fill="var(--color-primary)"
        />
        {/* casque / bill */}
        <path
          d="M17.4 9.3c1.6 0 2.9.5 2.9 1.2 0 .6-.9 1-2.1 1.1l-4.6.4 3.8-2.7Z"
          fill="var(--color-primary-300)"
        />
        <circle cx="16.1" cy="9.1" r=".8" fill="var(--color-surface-inverse)" />
      </svg>
    </span>
  );
}

/** Mark plus wordmark, used in the sidebar and mobile header. */
export function Wordmark({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-sm font-semibold text-foreground">
          Hornbill TapTap
        </span>
        {subtitle && (
          <span className="truncate text-[10px] uppercase tracking-[0.08em] text-muted">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
