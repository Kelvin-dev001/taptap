import { cn } from "@/lib/cn";

/**
 * One band of the landing page.
 *
 * A landmark with an accessible name rather than a bare div, so the page reads
 * as a navigable document: screen-reader users can jump between "How it works"
 * and "Pricing" the same way a sighted visitor scans for them (§24).
 */
export function Section({
  id,
  label,
  tone = "default",
  className,
  children,
}: {
  id?: string;
  /** Names the landmark. Usually the same words as the visible heading. */
  label: string;
  tone?: "default" | "sunken" | "inverse";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      className={cn(
        // Clears the sticky nav when an anchor link jumps here.
        "scroll-mt-20 px-6 py-20 sm:py-24",
        tone === "sunken" && "bg-surface-sunken",
        tone === "inverse" && "bg-surface-inverse text-on-inverse",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

/** Eyebrow + heading + optional sub, with consistent rhythm across sections. */
export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "left",
  inverse,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  align?: "left" | "center";
  inverse?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex max-w-2xl flex-col gap-3",
        align === "center" && "mx-auto text-center",
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            "text-label uppercase tracking-[0.08em]",
            inverse ? "text-primary-300" : "text-primary-strong",
          )}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          "text-display text-balance",
          inverse ? "text-on-inverse" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {sub && (
        <p className={cn("text-body", inverse ? "text-on-inverse-muted" : "text-muted")}>
          {sub}
        </p>
      )}
    </div>
  );
}
