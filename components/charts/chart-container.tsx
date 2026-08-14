import * as React from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Series } from "./bar-chart";

/**
 * Frame for a chart: title, optional note, legend and an actions slot. Keeps
 * every chart on the page aligned instead of each one inventing its own header.
 */
export function ChartContainer({
  title,
  note,
  series,
  actions,
  children,
  className,
}: {
  title: string;
  note?: string;
  series?: Series[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card padding="md" className={cn("flex flex-col", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-card-title text-foreground">{title}</h2>
          {note && <p className="text-caption text-muted">{note}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {series && series.length > 0 && (
            <ul className="flex items-center gap-3">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 text-caption text-muted">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          {actions}
        </div>
      </div>
      {children}
    </Card>
  );
}
