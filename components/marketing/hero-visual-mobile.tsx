"use client";

import { useRef } from "react";
import { m, useScroll, useTransform, useReducedMotion, type Transition } from "motion/react";
import { NfcCard } from "./nfc-card";
import { PhoneFrame } from "./phone-frame";

/**
 * The card-taps-phone moment, for phones and tablets.
 *
 * The card crossing to the phone is the whole story here, exactly as on
 * desktop. It arrives from the left, nudges the handset, settles back, and the
 * screen wakes — one moving object, one idea. Afterwards the two drift at
 * slightly different rates as the page scrolls, which gives the composition
 * depth without pinning the viewport. The desktop hero scrubs a longer sequence
 * against a pinned screen; that costs 220vh of thumb on a handset, so mobile
 * gets a play-on-view version instead.
 *
 * The split of duties is deliberate: the entry animates X, SCALE and OPACITY,
 * while scroll owns Y and ROTATION. A property driven from both `style` and
 * `whileInView` fights itself, so each one has a single owner.
 *
 * LAYOUT NOTE, learned the hard way. The phone is sized by WIDTH and sits in
 * normal flow, so it sets this container's height. The previous version pinned
 * it by height while `PhoneFrame` derives its box from width via aspect-ratio,
 * so `w-full` resolved against a shrink-to-fit parent. The browser settled that
 * circular constraint by handing it the full containing block, and the handset
 * grew until it overhung the marquee below. Nothing here has a fixed height now:
 * the phone decides, and the card hangs off it.
 */

/** Tuple, not number[]: motion types `ease` as a 4-point cubic bezier. */
const EASE = [0.22, 1, 0.36, 1] as const;

/** How long the card takes to cross. The tap lands at 70% of it. */
const TRAVEL = 0.9;
const CONTACT = TRAVEL * 0.7;

export function HeroVisualMobile() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Progress as the composition crosses the viewport, rather than a pinned range.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Gentle, opposed drift. Small numbers on purpose: this should read as depth,
  // not as things sliding about.
  const cardDrift = useTransform(scrollYProgress, [0, 1], ["10%", "-12%"]);
  const cardTilt = useTransform(scrollYProgress, [0, 1], [-15, -7]);
  const phoneDrift = useTransform(scrollYProgress, [0, 1], ["-5%", "6%"]);

  const viewport = { once: true, margin: "0px 0px -60px 0px" };

  // The approach, the nudge, the settle. The overshoot past its resting spot is
  // what makes this read as a tap rather than a slide into place.
  const cardEntry = reduced
    ? {}
    : {
        initial: { x: "-38%", scale: 0.88, opacity: 0 },
        whileInView: {
          x: ["-38%", "5%", "0%"],
          scale: [0.88, 1.02, 1],
          opacity: [0, 1, 1],
        },
        transition: {
          duration: TRAVEL,
          times: [0, 0.7, 1],
          ease: EASE,
        } as Transition,
      };

  const phoneEntry = reduced
    ? {}
    : {
        initial: { opacity: 0, scale: 0.94 },
        whileInView: { opacity: 1, scale: 1 },
        transition: { duration: 0.5, ease: EASE } as Transition,
      };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative mx-auto flex w-full max-w-[21rem] justify-end sm:max-w-sm"
    >
      {/* Card: absolutely placed, so it can never add height to the row. It
          passes BEHIND the handset, which is where a card actually goes when
          you tap one — and it keeps the screen unobstructed once it lands. */}
      <m.div
        className="absolute left-0 top-1/2 w-[64%] -translate-y-1/2"
        style={reduced ? undefined : { y: cardDrift, rotate: cardTilt }}
        viewport={viewport}
        {...cardEntry}
      >
        <NfcCard />
      </m.div>

      {/* Phone: in flow and sized by width, so IT sets the container height. */}
      <m.div
        className="relative z-10 w-[46%]"
        style={reduced ? undefined : { y: phoneDrift }}
        viewport={viewport}
        {...phoneEntry}
      >
        {/* Warm light at the point of contact, behind the handset. */}
        <m.span
          className="absolute left-1/2 top-1/3 -z-10 block h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.4)_0%,rgba(249,115,22,0)_70%)]"
          viewport={viewport}
          initial={reduced ? undefined : { scale: 0.5, opacity: 0 }}
          whileInView={reduced ? undefined : { scale: 1.5, opacity: [0, 0.9, 0.4] }}
          transition={{ duration: 0.9, delay: CONTACT, ease: "easeOut" } as Transition}
        />

        <PhoneFrame />

        {/* The sleeping screen, lifting off the glass as the card lands. Inset
            and radius track PhoneFrame's own padding and corner at each
            breakpoint, so the panel covers the screen and not the bezel. */}
        {!reduced && (
          <m.span
            className="pointer-events-none absolute inset-[5px] block rounded-[1.5rem] bg-neutral-950 sm:inset-[6px] sm:rounded-[1.65rem]"
            viewport={viewport}
            initial={{ opacity: 1 }}
            whileInView={{ opacity: 0 }}
            transition={{ duration: 0.45, delay: CONTACT, ease: "easeOut" } as Transition}
          />
        )}
      </m.div>
    </div>
  );
}
