"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Field wires a visible label, hint and error message to its control via
 * generated ids — so a labelled input is the path of least resistance and the
 * placeholder-as-label pattern audited in UI-0 (A1–A4, A14) cannot come back.
 *
 *   <Field label="Phone" hint="We only use this to reach you" error={err}>
 *     <Input name="phone" />
 *   </Field>
 */
type FieldContextValue = {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

/** Props a control should spread onto itself to inherit its Field's wiring. */
export function useFieldControl() {
  const ctx = React.useContext(FieldContext);
  if (!ctx) return {};
  return {
    id: ctx.controlId,
    "aria-describedby": ctx.describedBy,
    "aria-invalid": ctx.invalid || undefined,
    required: ctx.required || undefined,
  } as const;
}

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-body-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  /** A string renders the message; `true` marks invalid without extra text. */
  error?: string | boolean;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const uid = React.useId();
  const controlId = `${uid}-control`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const errorText = typeof error === "string" ? error : undefined;
  const invalid = Boolean(error);

  const describedBy =
    [hint ? hintId : null, errorText ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider
      value={{ controlId, describedBy, invalid, required: Boolean(required) }}
    >
      <div className={cn("flex flex-col gap-1.5", className)}>
        <Label htmlFor={controlId}>
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </Label>
        {children}
        {hint && !errorText && (
          <p id={hintId} className="text-caption text-muted">
            {hint}
          </p>
        )}
        {errorText && (
          // Errors appear after submission, so they must be announced.
          <p id={errorId} role="alert" className="text-caption font-medium text-danger">
            {errorText}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
