"use client";

import { m, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * The headline, typed out.
 *
 * The whole string is in the DOM from the first server byte. Each character is
 * wrapped in a span that fades in on a stagger, which reads as typing while
 * leaving the text itself untouched: a screen reader announces the heading
 * normally, a crawler indexes it, and it is fully readable before any JavaScript
 * arrives. That rules out the usual approach of appending characters to state,
 * which ships an empty h1 to Google and an empty h1 to anyone whose bundle fails.
 *
 * `white-space: pre-wrap` on the wrapper does two jobs at once: it stops the
 * spaces between character spans collapsing while half the line is still
 * transparent, and unlike a non-breaking space it still lets the headline wrap
 * onto a second line, which it must do on a 360px screen.
 *
 * Under reduced motion the string renders plainly. There is no caret, because a
 * blinking caret IS the animation for anyone who asked for less of it.
 */
export function TypingHeadline({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <span className={className}>{text}</span>;

  // ~34ms a character: quick enough that a reader is never waiting, slow enough
  // to register as deliberate rather than as a flicker.
  const PER_CHARACTER = 0.034;
  const characters = Array.from(text);

  return (
    <m.span
      className={cn("whitespace-pre-wrap", className)}
      initial="hidden"
      animate="shown"
      variants={{ hidden: {}, shown: { transition: { staggerChildren: PER_CHARACTER } } }}
    >
      {characters.map((character, index) => (
        <m.span
          key={`${character}-${index}`}
          className="inline"
          variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0 } } }}
        >
          {character}
        </m.span>
      ))}

      {/* Caret: decorative, and it retires once the line is complete rather than
          blinking forever next to finished text. */}
      <m.span
        aria-hidden="true"
        className="ml-0.5 inline-block h-[0.85em] w-[3px] translate-y-[0.06em] rounded-sm bg-primary align-middle"
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0] }}
        transition={{
          duration: 0.9,
          repeat: 3,
          delay: characters.length * PER_CHARACTER,
          times: [0, 0.5, 1],
        }}
      />
    </m.span>
  );
}
