"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/cn";

/**
 * Unlike Tooltip, a Popover is focusable and may hold interactive content —
 * use it whenever the panel contains a control rather than a description.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-lg border border-border bg-surface p-4 shadow-lg",
          "data-[state=open]:animate-scale-in data-[state=closed]:animate-fade-out",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
