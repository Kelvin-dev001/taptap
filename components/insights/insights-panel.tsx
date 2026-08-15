"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lightbulb, X, ChevronDown, RotateCcw, CircleCheck } from "lucide-react";
import { Card, Badge, Button, IconButton, buttonVariants, useToast } from "@/components/ui";
import type { Insight, InsightSeverity } from "@/lib/insights";
import { dismissInsightAction, restoreInsightsAction } from "@/app/dashboard/insights-actions";
import { cn } from "@/lib/cn";

const SEVERITY: Record<InsightSeverity, { label: string; variant: "danger" | "warning" | "neutral" }> = {
  high: { label: "Needs attention", variant: "danger" },
  medium: { label: "Worth a look", variant: "warning" },
  low: { label: "Minor", variant: "neutral" },
};

const VISIBLE_BY_DEFAULT = 3;

/**
 * The slot UI-3 reserved, now filled.
 *
 * Every card shows the numbers behind its claim. That is not decoration: these
 * are rules, not a model, and an owner who can see the evidence can tell when a
 * rule is wrong about their business — which is the whole reason this ships as
 * Insights rather than under an AI label (§30.8).
 */
export function InsightsPanel({
  insights,
  emptyReason,
  hasDismissed,
}: {
  insights: Insight[];
  emptyReason: string;
  hasDismissed: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [expanded, setExpanded] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);

  const shown = expanded ? insights : insights.slice(0, VISIBLE_BY_DEFAULT);
  const hidden = insights.length - shown.length;

  async function dismiss(insight: Insight) {
    setPending(insight.key);
    const res = await dismissInsightAction(insight.key);
    setPending(null);
    if (res.error) {
      toast({ title: "Could not hide this", description: res.error, tone: "danger" });
      return;
    }
    router.refresh();
  }

  async function restore() {
    const res = await restoreInsightsAction();
    if (res.error) {
      toast({ title: "Could not restore", description: res.error, tone: "danger" });
      return;
    }
    toast({ title: "Hidden insights restored", tone: "success" });
    router.refresh();
  }

  return (
    <section aria-labelledby="insights-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="insights-heading"
          className="flex items-center gap-2 text-section-title text-foreground"
        >
          <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
          Insights
        </h2>
        {hasDismissed && (
          <button
            type="button"
            onClick={restore}
            className="inline-flex items-center gap-1 rounded text-caption text-muted hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Show hidden
          </button>
        )}
      </div>

      {insights.length === 0 ? (
        <Card padding="md" className="flex items-start gap-2.5">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-body-sm text-muted">{emptyReason}</p>
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {shown.map((insight) => (
              <li key={insight.key}>
                <Card padding="sm" className="flex gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={SEVERITY[insight.severity].variant} dot>
                        {SEVERITY[insight.severity].label}
                      </Badge>
                    </div>

                    <p className="text-card-title text-foreground">{insight.title}</p>
                    <p className="text-body-sm text-foreground-secondary">{insight.detail}</p>

                    {/* The numbers this claim rests on, stated plainly. */}
                    <ul className="mt-0.5 flex flex-col gap-0.5">
                      {insight.evidence.map((line) => (
                        <li key={line} className="flex items-start gap-1.5 text-caption text-muted">
                          <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-border-strong" />
                          {line}
                        </li>
                      ))}
                    </ul>

                    {insight.action && (
                      <Link
                        href={insight.action.href}
                        className={cn(
                          buttonVariants({ variant: "secondary", size: "sm" }),
                          "mt-2 self-start",
                        )}
                      >
                        {insight.action.label}
                      </Link>
                    )}
                  </div>

                  <IconButton
                    label={`Hide: ${insight.title}`}
                    size="md"
                    disabled={pending === insight.key}
                    onClick={() => dismiss(insight)}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </Card>
              </li>
            ))}
          </ul>

          {hidden > 0 && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setExpanded(true)}>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              Show {hidden} more
            </Button>
          )}

          <p className="text-caption text-muted">
            Insights come from your own numbers — each one shows the figures behind it. They are
            worked out from rules, not predictions.
          </p>
        </>
      )}
    </section>
  );
}
