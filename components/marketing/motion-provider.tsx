"use client";

import { LazyMotion, domAnimation } from "motion/react";

/**
 * Loads only the DOM animation features `motion` needs, once, for the whole
 * marketing page.
 *
 * `strict` forbids the full `motion.*` components, so every animated element
 * must use `m.*` — which is the point: `m` ships a fraction of the bundle, and
 * strict mode turns "someone imported the heavy one by habit" into a build-time
 * error rather than 30KB nobody notices on a mid-range Android.
 *
 * Children passed in from a Server Component stay server-rendered; this only
 * puts a provider above them, not a client boundary around their contents.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
