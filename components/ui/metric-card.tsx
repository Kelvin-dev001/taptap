import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "./card";

/**
 * A single headline number, optionally with a period-over-period delta.
 *
 * `delta` is deliberately optional and never defaulted to 0: when there is no
 * prior period to compare against, the card shows the number alone rather than
 * implying a flat trend. No fabricated movement (CLAUDE.md §15, §30.7).
 */
export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  chart,
  inverse,
  className,
}: {
  label: string;
  value: string | number;
  /** Percentage change vs the prior period. Omit when unknown. */
  delta?: number;
  /** What the delta compares against, e.g. "vs previous 30 days". */
  deltaLabel?: string;
  hint?: string;
  /** Slot for a sparkline (UI-3). */
  chart?: React.ReactNode;
  inverse?: boolean;
  className?: string;
}) {
  const direction = delta === undefined ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const TrendIcon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <Card
      variant={inverse ? "inverse" : "default"}
      padding="sm"
      className={cn("relative overflow-hidden", inverse && "shadow-glow", className)}
    >
      <p
        className={cn(
          "text-label uppercase",
          inverse ? "text-on-inverse-muted" : "text-muted",
        )}
      >
        {label}
      </p>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn("tabular text-metric", inverse ? "text-on-inverse" : "text-foreground")}>
          {value}
        </span>

        {direction && (
          // Icon + sign carry the meaning, so trend is never colour-only (1.4.1).
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-caption font-medium",
              direction === "up" && (inverse ? "text-primary-300" : "text-success"),
              direction === "down" && (inverse ? "text-on-inverse-muted" : "text-danger"),
              direction === "flat" && (inverse ? "text-on-inverse-muted" : "text-muted"),
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular">
              {delta! > 0 ? "+" : ""}
              {delta!.toFixed(1)}%
            </span>
            <span className="sr-only">
              {direction === "up" ? "increase" : direction === "down" ? "decrease" : "no change"}
              {deltaLabel ? ` ${deltaLabel}` : ""}
            </span>
          </span>
        )}
      </div>

      {hint && (
        <p className={cn("mt-1 text-caption", inverse ? "text-on-inverse-muted" : "text-muted")}>
          {hint}
        </p>
      )}

      {chart && <div className="mt-3">{chart}</div>}
    </Card>
  );
}
