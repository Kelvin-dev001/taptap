"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-[18px] w-[18px] shrink-0 rounded-sm border border-border-strong bg-surface",
        "transition-colors duration-fast ease-standard",
        "data-[state=checked]:border-primary-strong data-[state=checked]:bg-primary-strong data-[state=checked]:text-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

/** Checkbox with a clickable label — the hit target covers the text too. */
export function CheckboxField({
  label,
  description,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  label: string;
  description?: string;
}) {
  const uid = React.useId();
  const descId = description ? `${uid}-desc` : undefined;

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Checkbox id={uid} aria-describedby={descId} className="mt-0.5" {...props} />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={uid} className="cursor-pointer text-body-sm text-foreground">
          {label}
        </label>
        {description && (
          <p id={descId} className="text-caption text-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
