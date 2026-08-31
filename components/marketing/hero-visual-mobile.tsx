"use client";

import { m, useReducedMotion, type Transition } from "motion/react";
import { NfcCard } from "./nfc-card";
import { PhoneFrame } from "./phone-frame";

/**
 * The card-taps-phone moment, for phones.
 *
 * The desktop hero scrubs this sequence against scroll position. That does not
 * work on a handset: pinning it cost 220vh of thumb before the reader met a
 * word of content, and the composition did not fit inside one screen anyway.
 *
 * So mobile gets the same story as a short sequence that plays once when it
 * scrolls into view. No pinning, no scroll tax, and the reader still sees the
 * card meet the phone and the profile appear.
 *
 * The two objects OVERLAP rather than sitting side by side. Side by side, each
 * got under half the width and the phone was too narrow to read: the business
 * name wrapped onto three lines and the first button fell out of the frame.
 * Overlapping gives the phone about half the width on its own and reads as a
 * deliberate composition rather than two shrunken props.
 */

/** Tuple, not number[]: motion types `ease` as a 4-point cubic bezier. */
const EASE = [0.22, 1, 0.36, 1] as const;

export function HeroVisualMobile() {
  const reduced = useReducedMotion();

  // Everything settles by ~1.4s. Long enough to read as a tap, short enough
  // that a reader scrolling past never waits for it.
  const cardMotion = reduced
    ? {}
    : {
        initial: { x: "-14%", y: "6%", rotate: -22, opacity: 0 },
        whileInView: { x: "0%", y: "0%", rotate: -12, opacity: 1 },
        transition: { duration: 0.7, ease: EASE } as Transition,
      };

  const phoneMotion = reduced
    ? {}
    : {
        initial: { y: "8%", opacity: 0 },
        whileInView: { y: "0%", opacity: 1 },
        transition: { duration: 0.6, delay: 0.15, ease: EASE } as Transition,
      };

  const screenMotion = reduced
    ? {}
    : {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        transition: { duration: 0.45, delay: 0.75 } as Transition,
      };

  const rippleMotion = reduced
    ? {}
    : {
        initial: { scale: 0.5, opacity: 0 },
        whileInView: { scale: 2.4, opacity: [0, 0.55, 0] },
        transition: { duration: 0.9, delay: 0.55, ease: "easeOut" } as Transition,
      };

  const viewport = { once: true, margin: "0px 0px -60px 0px" };

  return (
    <div aria-hidden="true" className="relative mx-auto h-full w-full max-w-sm">
      {/* Card, behind and to the left. */}
      <m.div
        className="absolute left-0 top-1/2 w-[58%] -translate-y-1/2"
        viewport={viewport}
        {...cardMotion}
      >
        <NfcCard />
      </m.div>

      {/* Phone, in front and to the right, with room to actually be read. */}
      <m.div
        className="absolute right-0 top-1/2 z-10 h-[92%] -translate-y-1/2"
        viewport={viewport}
        {...phoneMotion}
      >
        <div className="relative h-full">
          <m.span
            className="absolute left-1/2 top-1/3 -z-10 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.5)_0%,rgba(249,115,22,0)_70%)]"
            viewport={viewport}
            {...rippleMotion}
          />
          <div className="h-full">
            <PhoneFrame className="h-full [&>div]:h-full [&>div]:w-auto" />
            {/* The screen wakes after the card lands. Overlaid rather than
                animating the frame itself, so the handset never flickers. */}
            <m.div
              className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-neutral-950"
              viewport={viewport}
              initial={reduced ? { opacity: 0 } : { opacity: 1 }}
              whileInView={{ opacity: 0 }}
              transition={screenMotion.transition}
            />
          </div>
        </div>
      </m.div>
    </div>
  );
}
