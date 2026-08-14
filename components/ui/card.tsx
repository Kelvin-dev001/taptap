import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const cardVariants = cva("rounded-xl transition-shadow duration-base ease-standard", {
  variants: {
    variant: {
      default: "border border-border bg-surface shadow-xs",
      elevated: "border border-border bg-surface-elevated shadow-sm",
      /**
       * Charcoal surface used for the hero metric and AI cards. This is a
       * surface choice on a light page, not a dark theme (CLAUDE.md §30.17).
       */
      inverse: "bg-surface-inverse text-on-inverse shadow-md",
      sunken: "bg-surface-sunken",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
    },
    interactive: {
      true: "cursor-pointer hover:shadow-md",
    },
  },
  defaultVariants: { variant: "default", padding: "md" },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant, padding, interactive, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, interactive }), className)}
      {...props}
    />
  );
});

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-card-title text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-caption text-muted", className)} {...props} />;
}
