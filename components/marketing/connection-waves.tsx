"use client";

import { m, useTransform, type MotionValue, type Transition } from "motion/react";

/**
 * Rings radiating from the point where the card meets the phone.
 *
 * Concentric and staggered rather than one expanding blob: a single pulse reads
 * as a button press, whereas rings leaving one after another read as a signal
 * travelling outward, which is the idea being sold. It is the same shape as the
 * contactless glyph on the card itself, so the two rhyme.
 *
 * Rings are borders on a circle and animate only scale and opacity, so each one
 * is a compositor layer and none of them triggers layout or paint. Four is the
 * ceiling: past that they stop reading as distinct waves and start looking like
 * a smear on a 60Hz phone.
 *
 * Both variants below are decorative and hidden from assistive tech by the hero
 * that hosts them.
 */

const RINGS = [0, 1, 2, 3];

/** Ring geometry, shared so the two variants cannot drift apart visually. */
const RING_CLASS =
  "absolute left-1/2 top-1/2 block rounded-full border border-primary/45 " +
  "h-24 w-24 -translate-x-1/2 -translate-y-1/2 will-change-transform " +
  "sm:h-28 sm:w-28";

/**
 * Plays once when the hero enters view. Used on phones, where the sequence is
 * triggered rather than scrubbed.
 *
 * `delay` should land just after the card arrives, so the waves look caused by
 * the tap rather than coincident with it.
 */
export function ConnectionWavesOnView({
  delay = 0.5,
  reduced,
}: {
  delay?: number;
  reduced?: boolean | null;
}) {
  // Under reduced motion the waves are the whole effect, so there is nothing
  // meaningful to show statically. A single still ring would read as a stray
  // circle drawn on the phone.
  if (reduced) return null;

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {RINGS.map((index) => (
        <m.span
          key={index}
          className={RING_CLASS}
          initial={{ scale: 0.25, opacity: 0 }}
          whileInView={{ scale: [0.25, 2.4], opacity: [0, 0.55, 0] }}
          viewport={{ once: true, margin: "0px 0px -60px 0px" }}
          transition={
            {
              duration: 1.6,
              // Each ring leaves a beat after the one before it.
              delay: delay + index * 0.22,
              ease: "easeOut",
              times: [0, 1],
            } as Transition
          }
        />
      ))}
    </span>
  );
}

/**
 * Scrubbed against scroll. Used on desktop, where the whole hero is pinned and
 * the reader drives the sequence.
 *
 * Each ring gets its own slice of the progress range, so scrolling forward sends
 * waves out and scrolling back pulls them in. That reversibility is the reason
 * this is worth scrubbing rather than firing once: the reader can play with it.
 */
export function ConnectionWavesScrub({ progress }: { progress: MotionValue<number> }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {RINGS.map((index) => (
        <ScrubRing key={index} progress={progress} index={index} />
      ))}
    </span>
  );
}

function ScrubRing({ progress, index }: { progress: MotionValue<number>; index: number }) {
  // Contact lands at ~0.55 in the hero's timeline. Rings start there and stagger
  // out, with the last one still travelling as the card fades.
  const start = 0.5 + index * 0.055;
  const end = start + 0.3;

  const scale = useTransform(progress, [start, end], [0.25, 2.4]);
  const opacity = useTransform(
    progress,
    [start, start + (end - start) * 0.35, end],
    [0, 0.55, 0],
  );

  return <m.span className={RING_CLASS} style={{ scale, opacity }} />;
}
