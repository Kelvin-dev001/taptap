"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";

/** Mount once near the root of an app region; Radix shares timing across tooltips. */
export const TooltipProvider = TooltipPrimitive.Provider;

/**
 * A tooltip may only ever repeat or expand on an existing accessible name —
 * never carry information available nowhere else, since it is unreachable on
 * touch devices. Most of the product is used on phones.
 */
export function Tooltip({
  content,
  side = "right",
  children,
}: {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(
            "z-50 rounded-md bg-surface-inverse px-2 py-1 text-caption text-on-inverse shadow-md",
            "data-[state=delayed-open]:animate-fade-in",
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
