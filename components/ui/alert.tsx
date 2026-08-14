import * as React from "react";
import { CircleCheck, TriangleAlert, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/cn";

const TONES = {
  info: { cls: "border-info/20 bg-info-soft text-info", Icon: Info },
  success: { cls: "border-success/20 bg-success-soft text-success", Icon: CircleCheck },
  warning: { cls: "border-warning/20 bg-warning-soft text-warning", Icon: TriangleAlert },
  danger: { cls: "border-danger/20 bg-danger-soft text-danger", Icon: CircleAlert },
} as const;

/**
 * Inline, non-dismissable message tied to the surrounding content.
 * `danger` renders role="alert" so failures are announced immediately;
 * quieter tones use role="status" (polite) to avoid interrupting (4.1.3).
 */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { cls, Icon } = TONES[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-lg border p-3", cls, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        {title && <p className="text-body-sm font-semibold">{title}</p>}
        {children && <div className="text-body-sm text-foreground-secondary">{children}</div>}
      </div>
    </div>
  );
}
