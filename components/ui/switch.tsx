"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

/**
 * Radix supplies role="switch", aria-checked and Space/Enter handling; we own
 * the visuals. The "on" state uses the vivid brand orange because the track
 * carries no text (D-012).
 */
export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent transition-colors duration-base ease-standard",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-strong",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0",
          "transition-transform duration-base ease-standard",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

/** Switch with a clickable label and optional description, correctly associated. */
export function SwitchField({
  label,
  description,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
  label: string;
  description?: string;
}) {
  const uid = React.useId();
  const descId = description ? `${uid}-desc` : undefined;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={uid} className="cursor-pointer text-body-sm font-medium text-foreground">
          {label}
        </label>
        {description && (
          <p id={descId} className="text-caption text-muted">
            {description}
          </p>
        )}
      </div>
      <Switch id={uid} aria-describedby={descId} {...props} />
    </div>
  );
}
