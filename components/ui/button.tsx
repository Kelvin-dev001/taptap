import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

/**
 * Primary actions use --primary-strong (#C2560A), NOT the vivid brand orange:
 * white on #F97316 is 2.80:1 and fails WCAG AA. See D-012.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg",
    "font-medium transition-all duration-fast ease-standard",
    "disabled:pointer-events-none disabled:opacity-50",
    // Press feedback; suppressed under prefers-reduced-motion via the marker.
    "active:scale-[0.98]",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary-strong text-white shadow-xs hover:bg-primary-strong-hover hover:shadow-sm",
        secondary:
          "border border-border-strong bg-surface text-foreground shadow-xs hover:bg-surface-sunken",
        ghost: "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground",
        danger: "bg-danger text-white shadow-xs hover:brightness-95 hover:shadow-sm",
        inverse:
          "bg-surface-inverse text-on-inverse shadow-xs hover:bg-surface-inverse-elevated hover:shadow-sm",
      },
      size: {
        // Every size clears the 24px minimum target (WCAG 2.2 — 2.5.8).
        sm: "h-8 px-3 text-body-sm",
        md: "h-10 px-4 text-body-sm",
        lg: "h-11 px-5 text-body",
      },
      full: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner and blocks interaction. Width is preserved to avoid reflow. */
  loading?: boolean;
  /** Announced to screen readers while `loading`. */
  loadingText?: string;
  /**
   * Render the child element with button styling instead of a <button>.
   * Use for links that should look like buttons — the element stays an anchor,
   * so it keeps link semantics, middle-click and open-in-new-tab (finding A5).
   */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      full,
      loading,
      loadingText,
      children,
      disabled,
      type,
      asChild,
      ...props
    },
    ref,
  ) {
    const classes = cn(buttonVariants({ variant, size, full }), className);

    if (asChild) {
      // A slotted element is not a <button>: type, disabled and the spinner do
      // not apply, and silently accepting `loading` here would look like it
      // works. Callers that need those should use a real button.
      return (
        <Slot ref={ref} data-motion-press className={classes} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        // Buttons default to type="submit" inside a form, which fires actions by
        // accident. Callers opt in explicitly.
        type={type ?? "button"}
        data-motion-press
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={classes}
        {...props}
      >
        {loading && <Spinner className="h-4 w-4" />}
        {loading && loadingText ? loadingText : children}
      </button>
    );
  },
);

export { buttonVariants };
