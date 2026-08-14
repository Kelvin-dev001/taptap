"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type Series = { key: string; label: string; color: string };
export type BarDatum = { label: string; values: Record<string, number> };

/**
 * How to render a bar's label. This is a string rather than a formatter
 * function on purpose: BarChart is a Client Component, and functions cannot
 * cross the server/client boundary — passing one throws
 * "Functions cannot be passed directly to Client Components".
 *
 * The date format is deliberately locale-independent. `toLocaleDateString`
 * would format with the server's locale during SSR and the user's on hydration,
 * producing a mismatch.
 */
export type LabelFormat = "raw" | "date";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatBarLabel(label: string, format: LabelFormat): string {
  if (format !== "date") return label;
  // Dates arrive as YYYY-MM-DD from Postgres; parse the parts directly so no
  // timezone shift can move a bar to the previous day.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(label);
  if (!match) return label;
  const [, , month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${Number(day)} ${monthName}` : label;
}

/**
 * Grouped/stacked-free bar chart over a date axis.
 *
 * CSS grid rather than SVG: bars are rectangles, and this way each bar is a real
 * focusable element that can carry its own accessible description, so keyboard
 * and screen-reader users get the same numbers a mouse user gets from the
 * tooltip. The visual is backed by a visually-hidden table (WCAG 1.1.1).
 */
export function BarChart({
  data,
  series,
  height = 180,
  className,
  labelFormat = "raw",
}: {
  data: BarDatum[];
  series: Series[];
  height?: number;
  className?: string;
  labelFormat?: LabelFormat;
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const formatLabel = React.useCallback(
    (label: string) => formatBarLabel(label, labelFormat),
    [labelFormat],
  );

  const max = Math.max(
    1,
    ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)),
  );

  if (data.length === 0) {
    return <p className="py-8 text-center text-body-sm text-muted">No activity in this period.</p>;
  }

  const activeDatum = active !== null ? data[active] : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        {activeDatum && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded-md bg-surface-inverse px-2.5 py-1.5 text-caption text-on-inverse shadow-md"
          >
            <span className="font-medium">{formatLabel(activeDatum.label)}</span>
            {series.map((s) => (
              <span key={s.key} className="ml-2 text-on-inverse-muted">
                {s.label} {activeDatum.values[s.key] ?? 0}
              </span>
            ))}
          </div>
        )}

        <div
          className="flex items-end gap-[3px]"
          style={{ height }}
          onMouseLeave={() => setActive(null)}
        >
          {data.map((d, i) => {
            const total = series.reduce((sum, s) => sum + (d.values[s.key] ?? 0), 0);
            const description = `${formatLabel(d.label)}: ${series
              .map((s) => `${d.values[s.key] ?? 0} ${s.label}`)
              .join(", ")}`;
            return (
              <button
                key={d.label}
                type="button"
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={description}
                className="group flex h-full flex-1 items-end gap-[2px] rounded-sm"
              >
                {series.map((s) => {
                  const value = d.values[s.key] ?? 0;
                  return (
                    <span
                      key={s.key}
                      className={cn(
                        "flex-1 rounded-t-[2px] transition-opacity duration-fast",
                        active !== null && active !== i && "opacity-40",
                      )}
                      style={{
                        height: `${Math.max(value > 0 ? 3 : 1, (value / max) * 100)}%`,
                        backgroundColor: value > 0 ? s.color : "var(--color-border)",
                      }}
                    />
                  );
                })}
                <span className="sr-only">{total}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-caption text-muted">
        <span>{formatLabel(data[0].label)}</span>
        {data.length > 1 && <span>{formatLabel(data[data.length - 1].label)}</span>}
      </div>
    </div>
  );
}

/**
 * Horizontal ranked bars — "top actions", device split, and similar.
 * Values are printed, so the bar is reinforcement rather than the only signal.
 */
export function RankedBars({
  data,
  className,
  color = "var(--color-primary)",
}: {
  data: { label: string; value: number; hint?: string }[];
  className?: string;
  color?: string;
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-body-sm text-muted">Nothing recorded yet.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {data.map((d) => (
        <li key={d.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-body-sm">
            <span className="min-w-0 truncate text-foreground">{d.label}</span>
            <span className="tabular shrink-0 text-foreground-secondary">
              {d.value.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          {d.hint && <span className="text-caption text-muted">{d.hint}</span>}
        </li>
      ))}
    </ul>
  );
}
