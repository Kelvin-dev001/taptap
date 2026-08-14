import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center rounded-lg",
    "transition-all duration-fast ease-standard active:scale-[0.96]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        ghost: "text-muted hover:bg-surface-sunken hover:text-foreground",
        secondary:
          "border border-border-strong bg-surface text-foreground-secondary hover:bg-surface-sunken",
        danger: "text-muted hover:bg-danger-soft hover:text-danger",
      },
      size: {
        // 2.5.8 Target Size (Minimum) is 24px — sm is the floor, not a default.
        sm: "h-6 w-6",
        md: "h-9 w-9",
        lg: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Required: an icon-only control has no accessible name without it (4.1.2). */
  label: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className, variant, size, label, type, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        aria-label={label}
        title={label}
        data-motion-press
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
