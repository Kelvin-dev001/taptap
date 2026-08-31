import { cn } from "@/lib/cn";

/**
 * Fade-and-rise as a section scrolls into view — in CSS, with no JavaScript.
 *
 * These used to be `motion` components driven by `whileInView`, which meant
 * every wrapped section shipped in the server HTML at `opacity: 0` and became
 * readable only once the animation runtime had downloaded, parsed, hydrated and
 * fired an IntersectionObserver. That is a lot of machinery standing between a
 * customer and the words, and when any part of it slipped the content was
 * simply not there. The hero was showing exactly that failure.
 *
 * The replacement uses a scroll-driven CSS animation, which runs on the
 * compositor with no main-thread work, no observer and no client component at
 * all — these are Server Components now. Browsers without scroll-driven
 * animations get the content plainly visible, which is the correct answer
 * rather than a degraded one.
 *
 * THE RULE, and it is the whole point: the unanimated state is the FINISHED
 * state. The CSS only adds a beginning. Nothing here can leave content hidden.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /**
   * Holds this element back a beat relative to its neighbours. With a
   * scroll-driven animation there is no clock to delay against, so any value
   * moves the element to a later slice of its own entry — the same effect, read
   * off scroll position instead of time.
   */
  delay?: number;
  className?: string;
}) {
  return (
    <div className={cn("reveal", delay > 0 && "reveal-late", className)}>{children}</div>
  );
}

/**
 * Staggers its children so a grid reads as one movement instead of a dozen
 * unrelated ones. The offsets are per-child in CSS, so nothing has to be
 * threaded through the markup.
 */
export function RevealGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("reveal-group", className)}>{children}</div>;
}

/** A single item inside a RevealGroup. */
export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("reveal-item", className)}>{children}</div>;
}
