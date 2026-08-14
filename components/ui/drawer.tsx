"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./icon-button";

/**
 * Bottom sheet on mobile, side panel on desktop. Built on Radix Dialog so it
 * inherits the same focus trap, Escape handling and scroll lock — a drawer is
 * a modal that happens to be anchored to an edge.
 */
export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export function DrawerContent({
  className,
  children,
  title,
  description,
  side = "bottom",
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  side?: "bottom" | "right";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]",
          "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col border-border bg-surface shadow-lg",
          side === "bottom" && [
            "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t",
            "data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom",
          ],
          side === "right" && [
            "inset-y-0 right-0 w-[min(24rem,100vw-2rem)] border-l",
            "data-[state=open]:animate-slide-in-right data-[state=closed]:animate-fade-out",
          ],
          className,
        )}
        {...props}
      >
        {side === "bottom" && (
          // Grab affordance; the close button is the actual control.
          <span className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong" aria-hidden="true" />
        )}
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-section-title text-foreground">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-body-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <IconButton label="Close">
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
