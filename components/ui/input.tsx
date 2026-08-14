"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";

export const inputBaseClass = cn(
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2",
  "text-body-sm text-foreground placeholder:text-muted",
  "transition-colors duration-fast ease-standard",
  "hover:border-muted",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted",
  "aria-[invalid=true]:border-danger",
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    const field = useFieldControl();
    return <input ref={ref} className={cn(inputBaseClass, "h-10", className)} {...field} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...props }, ref) {
  const field = useFieldControl();
  return (
    <textarea ref={ref} rows={rows} className={cn(inputBaseClass, "resize-y", className)} {...field} {...props} />
  );
});

/**
 * Native <select> on purpose: it opens the OS picker, which is faster and more
 * familiar on the low-end Android hardware most Kenyan SMEs use, and is
 * keyboard/screen-reader correct with no JavaScript. A rich combobox can be
 * added later where search or multi-select is genuinely needed.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  const field = useFieldControl();
  return (
    <select
      ref={ref}
      className={cn(inputBaseClass, "h-10 cursor-pointer appearance-none bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.65rem center",
      }}
      {...field}
      {...props}
    >
      {children}
    </select>
  );
});
