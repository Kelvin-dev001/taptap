"use client";

import { m, useReducedMotion } from "motion/react";

/**
 * Fade-and-rise as a section scrolls into view.
 *
 * `once` matters: content that re-animates every time it passes the viewport is
 * the difference between polish and a page that will not sit still. The trigger
 * fires slightly before the element is fully visible, so movement finishes as
 * the reader arrives rather than under their eye.
 *
 * With reduced motion the element is simply rendered — no transform, no delay.
 * Content never waits on animation to become readable, which is the actual
 * requirement behind §24 rather than merely shortening the duration.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}

/**
 * Staggers its children rather than each child managing its own delay, so a
 * grid reads as one movement instead of a dozen unrelated ones.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.07,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </m.div>
  );
}

/** A single item inside a RevealGroup. */
export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </m.div>
  );
}
