"use client";

import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

/**
 * Radix supplies the menu semantics that are tedious to hand-roll: roving
 * tabindex, typeahead, Escape, outside-click and aria-expanded on the trigger.
 */
export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg",
          "data-[state=open]:animate-scale-in data-[state=closed]:animate-fade-out",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  className,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & {
  destructive?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-body-sm outline-none",
        "data-[highlighted]:bg-surface-sunken",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        destructive
          ? "text-danger data-[highlighted]:bg-danger-soft"
          : "text-foreground-secondary data-[highlighted]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn("px-2.5 py-1.5 text-caption text-muted", className)}
      {...props}
    />
  );
}

export function DropdownSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator className={cn("my-1 h-px bg-border", className)} {...props} />
  );
}
