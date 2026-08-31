"use client";

import { useRef } from "react";
import { m, useScroll, useTransform, useReducedMotion, type Transition } from "motion/react";
import { NfcCard } from "./nfc-card";
import { PhoneFrame } from "./phone-frame";
import { ConnectionWavesOnView } from "./connection-waves";

/**
 * The card-taps-phone moment, for phones and tablets.
 *
 * Two things happen. The objects arrive with a short tap sequence when the hero
 * scrolls into view, then drift at slightly different rates as the page moves,
 * which is what gives the composition depth without pinning the viewport. The
 * desktop hero scrubs a longer sequence against a pinned screen; that costs
 * 220vh of thumb on a handset, so mobile gets this instead.
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

  const cardEntry = reduced
    ? {}
    : {
        initial: { x: "-18%", opacity: 0 },
        whileInView: { x: "0%", opacity: 1 },
        transition: { duration: 0.7, ease: EASE } as Transition,
      };

  const phoneEntry = reduced
    ? {}
    : {
        initial: { opacity: 0, scale: 0.94 },
        whileInView: { opacity: 1, scale: 1 },
        transition: { duration: 0.6, delay: 0.12, ease: EASE } as Transition,
      };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative mx-auto flex w-full max-w-[21rem] justify-end sm:max-w-sm"
    >
      {/* Card: absolutely placed, so it can never add height to the row. */}
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
        {/* Warm bloom behind the handset, then the waves over the top of it.
            The bloom is the light of the tap; the rings are the signal. */}
        <m.span
          className="absolute left-1/2 top-1/3 -z-10 block h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.4)_0%,rgba(249,115,22,0)_70%)]"
          viewport={viewport}
          initial={reduced ? undefined : { scale: 0.5, opacity: 0 }}
          whileInView={reduced ? undefined : { scale: 1.6, opacity: [0, 0.9, 0.5] }}
          transition={{ duration: 1, delay: 0.45, ease: "easeOut" } as Transition}
        />
        <PhoneFrame />
        <ConnectionWavesOnView delay={0.55} reduced={reduced} />
      </m.div>
    </div>
  );
}
